import mongoose from "mongoose";
import CustomerLedger from "../../../models/Accounting/CustomerLedger.model.js";
import VendorLedger from "../../../models/Accounting/VendorLedger.model.js";
import LedgerTransaction from "../../../models/Accounting/LedgerTransaction.model.js";
import Payment from "../../../models/Accounting/Payment.model.js";
import Customer from "../../../models/Auth/Customer.js";
import Vendor from "../../../models/Vendor.model.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import BulkOrder from "../../../models/order/BulkOrder.js";
import Employee from "../../../models/Auth/Employee.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../../Utils/response/responseHandler.js";

export const parseCreditDays = (cd) => {
  if (!cd) return 0;
  if (typeof cd === "number") return cd;
  if (typeof cd === "string") {
    const num = parseInt(cd.replace(/\D/g, ""), 10);
    return isNaN(num) ? 0 : num;
  }
  if (typeof cd === "object") {
    const raw = cd.name || cd.days || cd.creditDays || "";
    const num = parseInt(String(raw).replace(/\D/g, ""), 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

/**
 * Helper to calculate order totals, tax amounts, paid advances, and part-payment status
 */
export const calculateBulkOrderTotals = (bulkOrder) => {
  let taxableAmount = 0;
  let gstAmount = 0;
  let itemsCount = 0;

  if (Array.isArray(bulkOrder.orders)) {
    bulkOrder.orders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const price = Number(item.price || 0);
          const qty = Number(item.qty || 0);
          const gstPercent = Number(item.gst || 0);
          const discount = Number(item.discountAmount || 0);
          const base = price * qty - discount;
          taxableAmount += base;
          gstAmount += (base * gstPercent) / 100;
          itemsCount += qty;
        });
      }
    });
  }

  const shippingCharges = Number(bulkOrder.shippingCharges || 0);
  const otherCharges = Number(bulkOrder.otherCharges || 0);
  const grandTotal = Number((taxableAmount + gstAmount + shippingCharges + otherCharges).toFixed(2));
  const paidAmount = Number((bulkOrder.advanceAmount || 0).toFixed(2));
  const balanceDue = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));

  let paymentStatus = "UNPAID";
  if (paidAmount >= grandTotal && grandTotal > 0) {
    paymentStatus = "PAID";
  } else if (paidAmount > 0) {
    paymentStatus = "PARTIAL";
  }

  const partPaymentPercentage = grandTotal > 0 ? Math.min(100, Math.round((paidAmount / grandTotal) * 100)) : 0;

  return {
    itemsCount,
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    grandTotal,
    paidAmount,
    balanceDue,
    paymentStatus,
    partPaymentPercentage,
  };
};

/**
 * Helper to calculate credit limit utilization and alert flags:
 * - 20% Threshold Alert: utilization >= 80% and < 100%
 * - Color indicators: Healthy (<80% - Green), Warning (80%-99% - Amber), Exceeded (>=100% - Red)
 */
export const calculateCreditStatus = (creditLimit, creditUsed) => {
  const limit = Number(creditLimit || 0);
  const used = Number(creditUsed || 0);
  const percentage = limit > 0 ? Number(((used / limit) * 100).toFixed(1)) : 0;
  const availableCredit = Math.max(0, Number((limit - used).toFixed(2)));
  const exceededAmount = used > limit ? Number((used - limit).toFixed(2)) : 0;

  let creditStatus = "HEALTHY";
  if (limit > 0 && used >= limit) {
    creditStatus = "EXCEEDED";
  } else if (limit > 0 && used >= 0.8 * limit) {
    creditStatus = "WARNING_20_PERCENT";
  }

  return {
    creditLimit: limit,
    creditUsed: used,
    availableCredit,
    creditPercentage: percentage,
    creditStatus,
    exceededAmount,
    is20PercentAlert: creditStatus === "WARNING_20_PERCENT",
    isExceededAlert: creditStatus === "EXCEEDED",
  };
};

/**
 * 1. Customer Ledger Statement (Khata View)
 */
export const getCustomerLedgerStatement = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate, page, limit } = req.query;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_CUSTOMER_ID",
        "Invalid customer ID.",
      );
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return sendErrorResponse(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "Customer not found.",
      );
    }

    if (!customer.status?.isActive || customer.approvalWorkflow?.salesHeadApprovalStatus !== "APPROVED") {
      return sendErrorResponse(
        res,
        400,
        "CUSTOMER_NOT_APPROVED",
        "Customer registration approval is pending. Khata statement is accessible only after Sales Head approval.",
      );
    }

    const inheritedCreditLimit = Number(customer.creditLimit || 0);
    const inheritedCreditDays = parseCreditDays(customer.creditDays);
    const inheritedCreditUsed = Number(customer.creditUsed || 0);
    const inheritedAdvance = Number(customer.customerBalance || 0);

    let ledger = await CustomerLedger.findOne({ customerId })
      .populate("branchId", "name address")
      .populate("coaAccountId", "accountCode accountName");

    if (!ledger) {
      ledger = new CustomerLedger({
        ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
        customerId,
        customerType: customer.customerType || "Wholesale",
        creditLimit: inheritedCreditLimit,
        creditDays: inheritedCreditDays,
        creditUsed: inheritedCreditUsed,
        advanceAmount: inheritedAdvance,
        openingBalance: 0,
        currentBalance:
          inheritedCreditUsed > 0 ? inheritedCreditUsed : -inheritedAdvance,
        branchId: customer.branchId || null,
        tenantId: req.user?.tenantId || customer.tenantId || null,
        createdBy: req.user?.id || req.user?._id,
      });
      await ledger.save();
    } else {
      let needsSave = false;
      if (ledger.creditLimit !== inheritedCreditLimit) {
        ledger.creditLimit = inheritedCreditLimit;
        needsSave = true;
      }
      if (
        ledger.creditDays !== inheritedCreditDays &&
        inheritedCreditDays > 0
      ) {
        ledger.creditDays = inheritedCreditDays;
        needsSave = true;
      }
      if (ledger.creditUsed !== inheritedCreditUsed) {
        ledger.creditUsed = inheritedCreditUsed;
        needsSave = true;
      }
      if (ledger.advanceAmount !== inheritedAdvance) {
        ledger.advanceAmount = inheritedAdvance;
        needsSave = true;
      }
      if (needsSave) {
        await ledger.save();
      }
    }

    const activeCreditLimit = inheritedCreditLimit;
    const activeCreditUsed = inheritedCreditUsed;
    const activeAdvance = inheritedAdvance;
    const creditAlerts = calculateCreditStatus(activeCreditLimit, activeCreditUsed);

    const ledgerObj = ledger.toObject ? ledger.toObject() : ledger;

    const query = {
      $or: [
        { ledgerId: ledgerObj._id },
        { partyId: customerId, entityType: "Customer" },
      ],
    };

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.transactionDate.$lte = end;
      }
    }

    const isPaginationRequested = Boolean(page && limit);
    let transactionsQuery = LedgerTransaction.find(query)
      .sort({ transactionDate: -1, createdAt: -1 })
      .populate("createdBy", "name username");

    if (isPaginationRequested) {
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      transactionsQuery = transactionsQuery
        .skip(skip)
        .limit(parseInt(limit, 10));
    }

    const rawTransactions = await transactionsQuery.lean();
    const totalTransactions = await LedgerTransaction.countDocuments(query);

    let totalDebit = 0;
    let totalCredit = 0;

    const allTxnsForSummary = await LedgerTransaction.find(query).lean();
    allTxnsForSummary.forEach((txn) => {
      totalDebit += Number(txn.debit || 0);
      totalCredit += Number(txn.credit || 0);
    });

    // 1. Fetch all customer bulk orders for Part-Payment & Order Status tracking
    const bulkOrders = await BulkOrder.find({ "customer.customerId": customer._id })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch all payments for this customer to map installments / part payments
    const customerPayments = await Payment.find({ partyId: customer._id })
      .sort({ createdAt: 1 })
      .lean();

    // 3. Resolve salesperson / employee names for transactions
    const creatorIds = [
      ...rawTransactions.map((t) => t.createdBy).filter(Boolean),
    ];
    const employees = await Employee.find({ _id: { $in: creatorIds } }).lean();
    const employeeMap = new Map();
    employees.forEach((emp) => {
      employeeMap.set(emp._id.toString(), emp.employeeName || emp.username || "Staff");
    });

    const ordersMap = new Map();
    const customerOrdersList = bulkOrders.map((bo) => {
      const totals = calculateBulkOrderTotals(bo);
      const firstOrder = bo.orders?.[0] || {};
      const orderNumber = firstOrder.orderNumber || bo._id.toString().slice(-6).toUpperCase();

      // Find all payments allocated to this specific bulk order
      const matchedPayments = customerPayments.filter((p) =>
        (p.allocations || []).some(
          (a) =>
            String(a.invoiceId) === String(bo._id) ||
            a.invoiceNumber === orderNumber,
        ),
      );

      let allocatedSum = 0;
      const orderPayments = [];
      matchedPayments.forEach((p) => {
        const alloc = (p.allocations || []).find(
          (a) =>
            String(a.invoiceId) === String(bo._id) ||
            a.invoiceNumber === orderNumber,
        );
        const amt = Number(alloc?.allocatedAmount || p.grossAmount || 0);
        allocatedSum += amt;
        orderPayments.push({
          paymentId: p._id,
          paymentNumber: p.paymentNumber,
          paymentDate: p.createdAt,
          paymentMode: p.paymentMode || "BANK_TRANSFER",
          referenceNumber: p.paymentDetails?.referenceNumber || p.paymentNumber,
          amount: amt,
          remarks: p.paymentDetails?.remarks || "Part Payment",
          status: "CLEARED",
        });
      });

      // Include initial booking advance payment if advance was recorded
      const initialAdvance = Math.max(
        0,
        Number((Number(bo.advanceAmount || 0) - allocatedSum).toFixed(2)),
      );
      if (initialAdvance > 0) {
        orderPayments.unshift({
          paymentId: `ADV-${orderNumber}`,
          paymentNumber: `ADV-${orderNumber}`,
          paymentDate: bo.createdAt,
          paymentMode: "ADVANCE_ADJUSTMENT",
          referenceNumber: `ADV-${orderNumber}`,
          amount: initialAdvance,
          remarks: "Booking Advance Payment",
          status: "CLEARED",
        });
      }

      const orderEntry = {
        _id: bo._id,
        orderId: bo._id,
        orderNumber,
        createdAt: bo.createdAt,
        orderDate: bo.createdAt,
        orderStatus: firstOrder.status || "Submitted",
        statusHistory: firstOrder.statusHistory || [],
        trackingId: firstOrder.trackingId || null,
        itemsCount: totals.itemsCount,
        taxableAmount: totals.taxableAmount,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
        totalOrderPrice: totals.grandTotal,
        paidAmount: totals.paidAmount,
        advanceAmount: totals.paidAmount,
        balanceDue: totals.balanceDue,
        paymentStatus: totals.paymentStatus,
        partPaymentPercentage: totals.partPaymentPercentage,
        isGSTRegistered: Boolean(customer.isGSTRegistered),
        gstNumber: customer.gstNumber || customer.gstin || customer.GSTNo || "",
        items: firstOrder.items || [],
        orderPayments,
        challanUrl: bo.challanUrl || null,
        invoiceUrl: bo.invoiceUrl || null,
        hasChallan: Boolean(bo.challanUrl),
        hasInvoice: Boolean(bo.invoiceUrl),
        salesPersonName: firstOrder.statusHistory?.[0]?.changedByName || "Sales Staff",
      };
      ordersMap.set(bo._id.toString(), orderEntry);
      ordersMap.set(orderNumber, orderEntry);
      return orderEntry;
    });

    // 4. Enrich transactions with order details, part payments, and salesperson info
    const transactions = rawTransactions.map((t) => {
      let matchedOrder = null;
      if (t.voucherId && ordersMap.has(t.voucherId.toString())) {
        matchedOrder = ordersMap.get(t.voucherId.toString());
      } else if (t.referenceNumber && ordersMap.has(t.referenceNumber)) {
        matchedOrder = ordersMap.get(t.referenceNumber);
      }

      const createdByName =
        employeeMap.get(t.createdBy?.toString()) ||
        matchedOrder?.salesPersonName ||
        "Sales Staff";

      return {
        ...t,
        orderId: matchedOrder ? (matchedOrder.orderId || matchedOrder._id) : (t.voucherId || null),
        orderNumber: matchedOrder ? matchedOrder.orderNumber : (t.referenceNumber || null),
        challanUrl: matchedOrder ? matchedOrder.challanUrl : null,
        invoiceUrl: matchedOrder ? matchedOrder.invoiceUrl : null,
        hasChallan: matchedOrder ? Boolean(matchedOrder.challanUrl) : false,
        hasInvoice: matchedOrder ? Boolean(matchedOrder.invoiceUrl) : false,
        createdByName,
        orderDate: matchedOrder ? matchedOrder.orderDate : t.transactionDate,
        orderPayments: matchedOrder ? matchedOrder.orderPayments : [],
        orderStatus: matchedOrder ? matchedOrder.orderStatus : null,
        orderGrandTotal: matchedOrder ? matchedOrder.grandTotal : null,
        orderPaidAmount: matchedOrder ? matchedOrder.paidAmount : null,
        orderBalanceDue: matchedOrder ? matchedOrder.balanceDue : null,
        partPaymentStatus: matchedOrder ? matchedOrder.paymentStatus : null,
        partPaymentPercentage: matchedOrder ? matchedOrder.partPaymentPercentage : null,
        isGSTInvoice: Boolean(customer.isGSTRegistered),
        taxableAmount: matchedOrder ? matchedOrder.taxableAmount : null,
        gstAmount: matchedOrder ? matchedOrder.gstAmount : null,
      };
    });

    // 3. Build monthly breakdown aggregations for Monthly View
    const monthlyMap = new Map();
    allTxnsForSummary.forEach((t) => {
      const d = new Date(t.transactionDate || t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          month: key,
          monthLabel,
          totalDebit: 0,
          totalCredit: 0,
          transactionsCount: 0,
        });
      }
      const entry = monthlyMap.get(key);
      entry.totalDebit += Number(t.debit || 0);
      entry.totalCredit += Number(t.credit || 0);
      entry.transactionsCount += 1;
    });

    const monthlyBreakdown = Array.from(monthlyMap.values())
      .map((m) => ({
        ...m,
        netMovement: m.totalDebit - m.totalCredit,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const rawAddr = customer.address || customer.billToAddress;
    const formattedAddr =
      typeof rawAddr === "string"
        ? rawAddr
        : rawAddr && typeof rawAddr === "object"
          ? [
              rawAddr.address,
              rawAddr.city,
              rawAddr.state,
              rawAddr.zipCode,
              rawAddr.country,
            ]
              .filter(Boolean)
              .join(", ") ||
            rawAddr.branchName ||
            ""
          : "";

    const statementSummary = {
      customer: {
        id: customer._id,
        customerCode: customer.customerCode || customer.serialNumber,
        shopName: customer.shopName,
        ownerName: customer.ownerName,
        mobile:
          customer.mobileNo1 || customer.mobile || customer.mobileNo2 || "—",
        email: customer.businessEmail || customer.emailId,
        address: formattedAddr,
        gstin: customer.gstNumber || customer.gstin || customer.GSTNo || "Unregistered",
        isGSTRegistered: Boolean(customer.isGSTRegistered),
        gstType: customer.gstType?.name || customer.gstType || (customer.isGSTRegistered ? "Regular" : "Non-GST"),
        panCard: customer.panCard || "",
        aadharCard: customer.aadharCard || "",
      },
      ledgerMaster: {
        ledgerCode: ledgerObj.ledgerCode,
        creditLimit: activeCreditLimit,
        creditDays: ledgerObj.creditDays || inheritedCreditDays,
        creditUsed: activeCreditUsed,
        advanceAmount: activeAdvance,
        availableCredit: creditAlerts.availableCredit,
        creditPercentage: creditAlerts.creditPercentage,
        creditStatus: creditAlerts.creditStatus,
        exceededAmount: creditAlerts.exceededAmount,
        is20PercentAlert: creditAlerts.is20PercentAlert,
        isExceededAlert: creditAlerts.isExceededAlert,
        interestRate: ledgerObj.interestRate || 0,
        openingBalance: ledgerObj.openingBalance || 0,
        openingBalanceType: ledgerObj.openingBalanceType || "Debit",
        currentBalance:
          activeCreditUsed > 0 ? activeCreditUsed : -activeAdvance,
        overdueAmount: ledgerObj.overdueAmount || 0,
        ledgerStatus: ledgerObj.ledgerStatus || "Active",
        allowCreditSales: ledgerObj.allowCreditSales,
      },
      statistics: {
        openingBalance: ledgerObj.openingBalance || 0,
        creditUsed: activeCreditUsed,
        advanceAmount: activeAdvance,
        totalDebit,
        totalCredit,
        netMovement: totalDebit - totalCredit,
        closingBalance:
          activeCreditUsed > 0 ? activeCreditUsed : -activeAdvance,
      },
    };

    return sendSuccessResponse(
      res,
      200,
      {
        summary: statementSummary,
        transactions,
        orders: customerOrdersList,
        monthlyBreakdown,
        pagination: isPaginationRequested
          ? {
              total: totalTransactions,
              page: parseInt(page, 10),
              limit: parseInt(limit, 10),
              totalPages: Math.ceil(totalTransactions / parseInt(limit, 10)),
            }
          : null,
      },
      "Customer statement loaded successfully.",
    );
  } catch (error) {
    console.error("getCustomerLedgerStatement error:", error);
    return sendErrorResponse(res, 500, "STATEMENT_LOAD_FAILED", error.message);
  }
};

/**
 * 2. Vendor Ledger Statement
 */
export const getVendorLedgerStatement = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { startDate, endDate, page, limit } = req.query;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_VENDOR_ID",
        "Invalid vendor ID.",
      );
    }

    const vendor = await Vendor.findById(vendorId).lean();
    if (!vendor) {
      return sendErrorResponse(
        res,
        404,
        "VENDOR_NOT_FOUND",
        "Vendor not found.",
      );
    }

    const inheritedTerms =
      parseInt(String(vendor.paymentTerms || 0).replace(/\D/g, ""), 10) || 0;

    let ledger = await VendorLedger.findOne({ vendorId })
      .populate("branchId", "name address")
      .populate("coaAccountId", "accountCode accountName");

    if (!ledger) {
      ledger = new VendorLedger({
        ledgerCode: `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
        vendorId,
        vendorCategory: "Manufacturer",
        paymentTerms: inheritedTerms,
        openingBalance: 0,
        currentOutstanding: 0,
        branchId: null,
        tenantId: req.user?.tenantId || vendor.tenantId || null,
        createdBy: req.user?.id || req.user?._id,
      });
      await ledger.save();
    } else {
      let needsSave = false;
      if (!ledger.paymentTerms && inheritedTerms > 0) {
        ledger.paymentTerms = inheritedTerms;
        needsSave = true;
      }
      if (needsSave) await ledger.save();
    }

    const allTxnsBalance = await LedgerTransaction.find({
      $or: [
        { ledgerId: ledger._id },
        { partyId: vendorId, entityType: "Vendor" },
      ],
    })
      .sort({ transactionDate: 1, createdAt: 1 })
      .lean();

    let computedOutstanding = Number(ledger.openingBalance || 0);
    for (const t of allTxnsBalance) {
      computedOutstanding += Number(t.credit || 0);
      computedOutstanding -= Number(t.debit || 0);
    }

    // Sync to DB if different
    if (ledger.currentOutstanding !== computedOutstanding) {
      await VendorLedger.findByIdAndUpdate(ledger._id, {
        currentOutstanding: computedOutstanding,
      });
      ledger.currentOutstanding = computedOutstanding;
    }

    const ledgerObj = ledger.toObject ? ledger.toObject() : ledger;
    ledgerObj.currentOutstanding = computedOutstanding;

    const query = {
      $or: [
        { ledgerId: ledgerObj._id },
        { partyId: vendorId, entityType: "Vendor" },
      ],
    };

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.transactionDate.$lte = end;
      }
    }

    const isPaginationRequested = Boolean(page && limit);
    let transactionsQuery = LedgerTransaction.find(query)
      .sort({ transactionDate: -1, createdAt: -1 })
      .populate("createdBy", "name username");

    if (isPaginationRequested) {
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      transactionsQuery = transactionsQuery
        .skip(skip)
        .limit(parseInt(limit, 10));
    }

    const transactions = await transactionsQuery.lean();
    const totalTransactions = await LedgerTransaction.countDocuments(query);

    let totalDebit = 0;
    let totalCredit = 0;

    const allTxnsForSummary = await LedgerTransaction.find(query).lean();
    allTxnsForSummary.forEach((txn) => {
      totalDebit += Number(txn.debit || 0);
      totalCredit += Number(txn.credit || 0);
    });

    const statementSummary = {
      vendor: {
        id: vendor._id,
        name: vendor.name,
        firm: vendor.firm,
        mobile: vendor.mobile,
        email: vendor.email,
        address: vendor.address,
        gstin: vendor.gstNumber || vendor.gstin,
      },
      ledgerMaster: {
        ledgerCode: ledgerObj.ledgerCode,
        paymentTerms: ledgerObj.paymentTerms || inheritedTerms,
        openingBalance: ledgerObj.openingBalance || 0,
        openingBalanceType: ledgerObj.openingBalanceType || "Credit",
        currentOutstanding: computedOutstanding,
        overdueAmount: ledgerObj.overdueAmount || 0,
        ledgerStatus: ledgerObj.ledgerStatus || "Active",
      },
      statistics: {
        openingBalance: ledgerObj.openingBalance || 0,
        totalDebit,
        totalCredit,
        currentOutstanding: computedOutstanding,
      },
    };

    return sendSuccessResponse(
      res,
      200,
      {
        summary: statementSummary,
        transactions,
        pagination: isPaginationRequested
          ? {
              total: totalTransactions,
              page: parseInt(page, 10),
              limit: parseInt(limit, 10),
              totalPages: Math.ceil(totalTransactions / parseInt(limit, 10)),
            }
          : null,
      },
      "Vendor statement loaded successfully.",
    );
  } catch (error) {
    console.error("getVendorLedgerStatement error:", error);
    return sendErrorResponse(
      res,
      500,
      "VENDOR_STATEMENT_LOAD_FAILED",
      error.message,
    );
  }
};

/**
 * 3. Get All Customer Ledgers (Khata List - Syncs directly with Customer object)
 */
export const getCustomerLedgersList = async (req, res) => {
  try {
    const { search, status, creditFilter, gstFilter, month, branchId, page = 1, limit = 50 } = req.query;
    const tenantId = req.user?.tenantId || null;

    const customerQuery = {
      "status.isActive": true,
      "approvalWorkflow.salesHeadApprovalStatus": "APPROVED",
    };
    if (tenantId) {
      customerQuery.tenantId = tenantId;
    }

    if (gstFilter === "GST") {
      customerQuery.isGSTRegistered = true;
    } else if (gstFilter === "NON_GST") {
      customerQuery.isGSTRegistered = { $ne: true };
    }

    if (search) {
      customerQuery.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
        { mobileNo1: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { customerCode: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(customerQuery)
      .select(
        "shopName ownerName mobileNo1 mobileNo2 mobile businessEmail address branchId tenantId creditLimit creditDays creditUsed customerBalance customerCode serialNumber GSTNo gstNumber isGSTRegistered gstType panCard aadharCard createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    // Batch query bulk orders for all customers to compute order statuses and counts
    const customerIds = customers.map((c) => c._id);
    const bulkOrders = await BulkOrder.find({ "customer.customerId": { $in: customerIds } })
      .select("customer orders advanceAmount shippingCharges otherCharges createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const ordersByCustomer = new Map();
    bulkOrders.forEach((bo) => {
      const cId = bo.customer?.customerId?.toString();
      if (!cId) return;
      if (!ordersByCustomer.has(cId)) {
        ordersByCustomer.set(cId, []);
      }
      ordersByCustomer.get(cId).push(bo);
    });

    // Optional monthly date range if month filter provided (YYYY-MM)
    let monthStart = null;
    let monthEnd = null;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yr, mo] = month.split("-").map(Number);
      monthStart = new Date(yr, mo - 1, 1);
      monthEnd = new Date(yr, mo, 0, 23, 59, 59, 999);
    }

    // Pre-fetch monthly transactions if month is selected
    let monthlyTxnsMap = new Map();
    if (monthStart && monthEnd) {
      const mTxns = await LedgerTransaction.find({
        partyId: { $in: customerIds },
        entityType: "Customer",
        transactionDate: { $gte: monthStart, $lte: monthEnd },
      }).lean();

      mTxns.forEach((t) => {
        const cId = t.partyId?.toString();
        if (!cId) return;
        if (!monthlyTxnsMap.has(cId)) {
          monthlyTxnsMap.set(cId, { debit: 0, credit: 0, count: 0 });
        }
        const entry = monthlyTxnsMap.get(cId);
        entry.debit += Number(t.debit || 0);
        entry.credit += Number(t.credit || 0);
        entry.count += 1;
      });
    }

    let totalReceivable = 0;
    let totalAdvances = 0;
    let totalCreditLimit = 0;
    let activeCount = 0;
    let exceededLimitCount = 0;
    let warning20PercentCount = 0;
    let healthyCreditCount = 0;
    let gstCustomerCount = 0;
    let nonGstCustomerCount = 0;

    const ledgers = [];

    for (const cust of customers) {
      let l = await CustomerLedger.findOne({ customerId: cust._id })
        .populate("branchId", "name")
        .populate("coaAccountId", "accountCode accountName");

      const custCreditLimit = Number(cust.creditLimit || 0);
      const custCreditDays = parseCreditDays(cust.creditDays);
      const custCreditUsed = Number(cust.creditUsed || 0);
      const custAdvance = Number(cust.customerBalance || 0);

      if (!l) {
        l = await CustomerLedger.create({
          ledgerCode: `CUST-LED-${cust._id.toString().slice(-6).toUpperCase()}`,
          customerId: cust._id,
          customerType: "Wholesale",
          creditLimit: custCreditLimit,
          creditDays: custCreditDays,
          creditUsed: custCreditUsed,
          advanceAmount: custAdvance,
          openingBalance: 0,
          currentBalance: custCreditUsed > 0 ? custCreditUsed : -custAdvance,
          branchId: cust.branchId || null,
          tenantId,
          createdBy: req.user?.id || req.user?._id,
        });
      } else {
        let needsUpdate = false;
        if (l.creditLimit !== custCreditLimit) {
          l.creditLimit = custCreditLimit;
          needsUpdate = true;
        }
        if (l.creditDays !== custCreditDays && custCreditDays > 0) {
          l.creditDays = custCreditDays;
          needsUpdate = true;
        }
        if (l.creditUsed !== custCreditUsed) {
          l.creditUsed = custCreditUsed;
          needsUpdate = true;
        }
        if (l.advanceAmount !== custAdvance) {
          l.advanceAmount = custAdvance;
          needsUpdate = true;
        }
        if (needsUpdate) {
          await l.save();
        }
      }

      const lObj = l.toObject ? l.toObject() : l;

      const activeCreditLimit = custCreditLimit;
      const activeCreditUsed = custCreditUsed;
      const activeAdvance = custAdvance;
      const creditAlerts = calculateCreditStatus(activeCreditLimit, activeCreditUsed);

      // Global Counters across all customers
      totalReceivable += activeCreditUsed;
      totalAdvances += activeAdvance;
      totalCreditLimit += activeCreditLimit;
      if (lObj.ledgerStatus === "Active") activeCount++;

      if (creditAlerts.creditStatus === "EXCEEDED") {
        exceededLimitCount++;
      } else if (creditAlerts.creditStatus === "WARNING_20_PERCENT") {
        warning20PercentCount++;
      } else {
        healthyCreditCount++;
      }

      const isGSTReg = Boolean(cust.isGSTRegistered);
      if (isGSTReg) {
        gstCustomerCount++;
      } else {
        nonGstCustomerCount++;
      }

      // Filter by credit alert state if specified
      if (creditFilter && creditFilter !== "ALL") {
        if (creditFilter === "EXCEEDED" && creditAlerts.creditStatus !== "EXCEEDED") continue;
        if (creditFilter === "WARNING_20_PERCENT" && creditAlerts.creditStatus !== "WARNING_20_PERCENT") continue;
        if (creditFilter === "HEALTHY" && creditAlerts.creditStatus !== "HEALTHY") continue;
      }

      // Order metrics for this customer
      const custOrders = ordersByCustomer.get(cust._id.toString()) || [];
      const totalOrdersCount = custOrders.length;
      const activeOrders = custOrders.filter((bo) => {
        const st = bo.orders?.[0]?.status;
        return st && !["Delivered", "Cancelled", "Completed"].includes(st);
      });
      const activeOrdersCount = activeOrders.length;
      const latestOrder = custOrders[0] || null;
      const latestOrderStatus = latestOrder ? (latestOrder.orders?.[0]?.status || "Submitted") : null;
      const latestOrderNumber = latestOrder ? (latestOrder.orders?.[0]?.orderNumber || latestOrder._id.toString().slice(-6).toUpperCase()) : null;
      const latestOrderDate = latestOrder ? latestOrder.createdAt : null;

      // Monthly metrics
      const mStats = monthlyTxnsMap.get(cust._id.toString()) || { debit: 0, credit: 0, count: 0 };

      cust.mobile = cust.mobileNo1 || cust.mobile || cust.mobileNo2 || "—";
      cust.creditLimit = custCreditLimit;
      cust.creditDays = custCreditDays;
      cust.creditUsed = custCreditUsed;
      cust.customerBalance = custAdvance;
      cust.isGSTRegistered = isGSTReg;
      cust.gstNumber = cust.gstNumber || cust.GSTNo || "";
      cust.gstType = cust.gstType?.name || cust.gstType || (isGSTReg ? "Regular" : "Non-GST");

      lObj.customerId = cust;
      lObj.creditLimit = activeCreditLimit;
      lObj.creditDays = lObj.creditDays || custCreditDays;
      lObj.creditUsed = activeCreditUsed;
      lObj.advanceAmount = activeAdvance;
      lObj.availableCredit = creditAlerts.availableCredit;
      lObj.creditPercentage = creditAlerts.creditPercentage;
      lObj.creditStatus = creditAlerts.creditStatus;
      lObj.exceededAmount = creditAlerts.exceededAmount;
      lObj.is20PercentAlert = creditAlerts.is20PercentAlert;
      lObj.isExceededAlert = creditAlerts.isExceededAlert;
      lObj.currentBalance = activeCreditUsed > 0 ? activeCreditUsed : -activeAdvance;
      lObj.pendingDue = activeCreditUsed;
      lObj.isGSTRegistered = isGSTReg;
      lObj.gstNumber = cust.gstNumber;

      lObj.ordersSummary = {
        totalOrders: totalOrdersCount,
        activeOrders: activeOrdersCount,
        latestOrderStatus,
        latestOrderNumber,
        latestOrderDate,
      };

      lObj.monthlySummary = {
        month: month || null,
        monthlyInvoiced: mStats.debit,
        monthlyReceived: mStats.credit,
        netMovement: mStats.debit - mStats.credit,
        transactionsCount: mStats.count,
      };

      if (!status || lObj.ledgerStatus === status) {
        ledgers.push(lObj);
      }
    }

    return sendSuccessResponse(
      res,
      200,
      {
        ledgers,
        metrics: {
          totalReceivable,
          totalAdvances,
          totalCreditLimit,
          activeCount,
          exceededLimitCount,
          warning20PercentCount,
          healthyCreditCount,
          gstCustomerCount,
          nonGstCustomerCount,
        },
        pagination: {
          total: ledgers.length,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(ledgers.length / parseInt(limit, 10)),
        },
      },
      "Customer ledgers retrieved successfully.",
    );
  } catch (error) {
    console.error("getCustomerLedgersList error:", error);
    return sendErrorResponse(
      res,
      500,
      "GET_CUSTOMER_LEDGERS_FAILED",
      error.message,
    );
  }
};

/**
 * 4. Get All Vendor Ledgers (Syncs with Vendors)
 */
export const getVendorLedgersList = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const tenantId = req.user?.tenantId || null;

    const vendorQuery = {};
    if (tenantId) {
      vendorQuery.tenantId = tenantId;
    }

    if (search) {
      vendorQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { firm: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    const vendors = await Vendor.find(vendorQuery)
      .sort({ createdAt: -1 })
      .lean();

    const ledgers = [];
    for (const v of vendors) {
      let l = await VendorLedger.findOne({ vendorId: v._id })
        .populate("branchId", "name")
        .populate("coaAccountId", "accountCode accountName");

      const vPaymentTerms =
        parseInt(String(v.paymentTerms || 0).replace(/\D/g, ""), 10) || 0;

      if (!l) {
        l = await VendorLedger.create({
          ledgerCode: `VEND-LED-${v._id.toString().slice(-6).toUpperCase()}`,
          vendorId: v._id,
          paymentTerms: vPaymentTerms,
          openingBalance: 0,
          currentOutstanding: 0,
          branchId: null,
          tenantId,
          createdBy: req.user?.id || req.user?._id,
        });
      } else {
        const ledgerId = l._id;
        const txns = await LedgerTransaction.find({
          $or: [{ ledgerId }, { partyId: v._id, entityType: "Vendor" }],
        }).lean();

        let syncedBalance = Number(l.openingBalance || 0);
        txns.forEach((t) => {
          syncedBalance += Number(t.credit || 0);
          syncedBalance -= Number(t.debit || 0);
        });

        let needsUpdate = false;
        if ((!l.paymentTerms || l.paymentTerms === 0) && vPaymentTerms > 0) {
          l.paymentTerms = vPaymentTerms;
          needsUpdate = true;
        }
        if (l.currentOutstanding !== syncedBalance) {
          l.currentOutstanding = syncedBalance;
          needsUpdate = true;
        }
        if (needsUpdate) await l.save();
      }

      const lObj = l.toObject ? l.toObject() : l;
      lObj.vendorId = v;
      lObj.paymentTerms = lObj.paymentTerms || vPaymentTerms;

      if (!status || lObj.ledgerStatus === status) {
        ledgers.push(lObj);
      }
    }

    return sendSuccessResponse(
      res,
      200,
      {
        ledgers,
        pagination: {
          total: ledgers.length,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(ledgers.length / parseInt(limit, 10)),
        },
      },
      "Vendor ledgers retrieved successfully.",
    );
  } catch (error) {
    console.error("getVendorLedgersList error:", error);
    return sendErrorResponse(
      res,
      500,
      "GET_VENDOR_LEDGERS_FAILED",
      error.message,
    );
  }
};

/**
 * 5. Upsert Customer Ledger Master Settings
 */
export const upsertCustomerLedger = async (req, res) => {
  try {
    const {
      customerId,
      coaAccountId,
      customerType,
      creditLimit,
      creditDays,
      interestRate,
      openingBalance,
      openingBalanceType,
      ledgerStatus,
      allowCreditSales,
      branchId,
      remarks,
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_CUSTOMER_ID",
        "Valid customerId is required.",
      );
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return sendErrorResponse(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "Customer not found.",
      );
    }

    if (!customer.status?.isActive || customer.approvalWorkflow?.salesHeadApprovalStatus !== "APPROVED") {
      return sendErrorResponse(
        res,
        400,
        "CUSTOMER_NOT_APPROVED",
        "Customer registration approval is pending. Ledger settings can only be configured for approved customers.",
      );
    }

    let ledger = await CustomerLedger.findOne({ customerId });
    if (!ledger) {
      ledger = new CustomerLedger({
        ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
        customerId,
        currentBalance: Number(openingBalance || 0),
        tenantId,
        createdBy: userId,
      });
    }

    if (coaAccountId && mongoose.Types.ObjectId.isValid(coaAccountId))
      ledger.coaAccountId = coaAccountId;
    if (customerType) ledger.customerType = customerType;
    if (creditLimit !== undefined) ledger.creditLimit = Number(creditLimit);
    if (creditDays !== undefined) ledger.creditDays = Number(creditDays);
    if (interestRate !== undefined) ledger.interestRate = Number(interestRate);
    if (openingBalance !== undefined)
      ledger.openingBalance = Number(openingBalance);
    if (openingBalanceType) ledger.openingBalanceType = openingBalanceType;
    if (ledgerStatus) ledger.ledgerStatus = ledgerStatus;
    if (allowCreditSales !== undefined)
      ledger.allowCreditSales = Boolean(allowCreditSales);
    if (branchId && mongoose.Types.ObjectId.isValid(branchId))
      ledger.branchId = branchId;
    if (remarks !== undefined) ledger.remarks = remarks;

    await ledger.save();

    if (creditLimit !== undefined || creditDays !== undefined) {
      const custUpdate = {};
      if (creditLimit !== undefined)
        custUpdate.creditLimit = Number(creditLimit);
      if (creditDays !== undefined)
        custUpdate["creditDays.name"] = `${creditDays} Days`;
      await Customer.findByIdAndUpdate(customerId, { $set: custUpdate });
    }

    return sendSuccessResponse(
      res,
      200,
      ledger,
      "Customer ledger settings saved.",
    );
  } catch (error) {
    console.error("upsertCustomerLedger error:", error);
    return sendErrorResponse(
      res,
      500,
      "UPSERT_CUSTOMER_LEDGER_FAILED",
      error.message,
    );
  }
};

/**
 * 6. Upsert Vendor Ledger Master Settings
 */
export const upsertVendorLedger = async (req, res) => {
  try {
    const {
      vendorId,
      coaAccountId,
      gstin,
      pan,
      paymentTerms,
      openingBalance,
      openingBalanceType,
      ledgerStatus,
      branchId,
      remarks,
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_VENDOR_ID",
        "Valid vendorId is required.",
      );
    }

    let ledger = await VendorLedger.findOne({ vendorId });
    if (!ledger) {
      ledger = new VendorLedger({
        ledgerCode: `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
        vendorId,
        currentOutstanding: Number(openingBalance || 0),
        tenantId,
        createdBy: userId,
      });
    }

    if (coaAccountId && mongoose.Types.ObjectId.isValid(coaAccountId))
      ledger.coaAccountId = coaAccountId;
    if (gstin) ledger.gstin = gstin;
    if (pan) ledger.pan = pan;
    if (paymentTerms !== undefined) ledger.paymentTerms = Number(paymentTerms);
    if (openingBalance !== undefined)
      ledger.openingBalance = Number(openingBalance);
    if (openingBalanceType) ledger.openingBalanceType = openingBalanceType;
    if (ledgerStatus) ledger.ledgerStatus = ledgerStatus;
    if (branchId && mongoose.Types.ObjectId.isValid(branchId))
      ledger.branchId = branchId;
    if (remarks !== undefined) ledger.remarks = remarks;

    await ledger.save();

    if (paymentTerms !== undefined) {
      await Vendor.findByIdAndUpdate(vendorId, {
        $set: { paymentTerms: `${paymentTerms} Days` },
      });
    }

    return sendSuccessResponse(
      res,
      200,
      ledger,
      "Vendor ledger settings saved.",
    );
  } catch (error) {
    console.error("upsertVendorLedger error:", error);
    return sendErrorResponse(
      res,
      500,
      "UPSERT_VENDOR_LEDGER_FAILED",
      error.message,
    );
  }
};

/**
 * 7. Get Customer Orders for Ledger & Part-Payment Tracking
 */
export const getCustomerOrdersForLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_CUSTOMER_ID",
        "Invalid customer ID.",
      );
    }

    const customer = await Customer.findById(customerId)
      .select("shopName ownerName isGSTRegistered gstNumber customerBalance creditUsed creditLimit")
      .lean();

    if (!customer) {
      return sendErrorResponse(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "Customer not found.",
      );
    }

    const bulkOrders = await BulkOrder.find({ "customer.customerId": customerId })
      .sort({ createdAt: -1 })
      .lean();

    const orders = bulkOrders.map((bo) => {
      const totals = calculateBulkOrderTotals(bo);
      const firstOrder = bo.orders?.[0] || {};
      const orderNumber = firstOrder.orderNumber || bo._id.toString().slice(-6).toUpperCase();

      return {
        _id: bo._id,
        orderId: bo._id,
        orderNumber,
        createdAt: bo.createdAt,
        orderDate: bo.createdAt,
        orderStatus: firstOrder.status || "Submitted",
        statusHistory: firstOrder.statusHistory || [],
        trackingId: firstOrder.trackingId || null,
        itemsCount: totals.itemsCount,
        taxableAmount: totals.taxableAmount,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
        totalOrderPrice: totals.grandTotal,
        paidAmount: totals.paidAmount,
        advanceAmount: totals.paidAmount,
        balanceDue: totals.balanceDue,
        paymentStatus: totals.paymentStatus,
        partPaymentPercentage: totals.partPaymentPercentage,
        isGSTRegistered: Boolean(customer.isGSTRegistered),
        gstNumber: customer.gstNumber || "",
        items: firstOrder.items || [],
      };
    });

    return sendSuccessResponse(
      res,
      200,
      { orders },
      "Customer orders loaded for part-payment tracking.",
    );
  } catch (error) {
    console.error("getCustomerOrdersForLedger error:", error);
    return sendErrorResponse(
      res,
      500,
      "GET_CUSTOMER_ORDERS_FAILED",
      error.message,
    );
  }
};

