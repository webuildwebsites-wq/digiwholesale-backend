import mongoose from 'mongoose';
import CustomerLedger from '../../../models/Accounting/CustomerLedger.model.js';
import VendorLedger from '../../../models/Accounting/VendorLedger.model.js';
import LedgerTransaction from '../../../models/Accounting/LedgerTransaction.model.js';
import Payment from '../../../models/Accounting/Payment.model.js';
import Customer from '../../../models/Auth/Customer.js';
import Vendor from '../../../models/Vendor.model.js';
import VendorPurchase from '../../../models/Purchase/VendorPurchase.model.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';

const parseCreditDays = (cd) => {
  if (!cd) return 0;
  if (typeof cd === 'number') return cd;
  if (typeof cd === 'string') {
    const num = parseInt(cd.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }
  if (typeof cd === 'object') {
    const raw = cd.name || cd.days || cd.creditDays || '';
    const num = parseInt(String(raw).replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

/**
 * 1. Customer Ledger Statement (Khata View)
 */
export const getCustomerLedgerStatement = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate, page, limit } = req.query;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_CUSTOMER_ID', 'Invalid customer ID.');
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return sendErrorResponse(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
    }

    const inheritedCreditLimit = Number(customer.creditLimit || 0);
    const inheritedCreditDays = parseCreditDays(customer.creditDays);
    const inheritedCreditUsed = Number(customer.creditUsed || 0);
    const inheritedAdvance = Number(customer.customerBalance || 0);

    let ledger = await CustomerLedger.findOne({ customerId })
      .populate('branchId', 'name address')
      .populate('coaAccountId', 'accountCode accountName');

    if (!ledger) {
      ledger = new CustomerLedger({
        ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
        customerId,
        customerType: customer.customerType || 'Wholesale',
        creditLimit: inheritedCreditLimit,
        creditDays: inheritedCreditDays,
        creditUsed: inheritedCreditUsed,
        advanceAmount: inheritedAdvance,
        openingBalance: 0,
        currentBalance: inheritedCreditUsed > 0 ? inheritedCreditUsed : -inheritedAdvance,
        branchId: customer.branchId || null,
        tenantId: req.user?.tenantId || customer.tenantId || null,
        createdBy: req.user?.id || req.user?._id
      });
      await ledger.save();
    } else {
      let needsSave = false;
      if (ledger.creditLimit !== inheritedCreditLimit) {
        ledger.creditLimit = inheritedCreditLimit;
        needsSave = true;
      }
      if (ledger.creditDays !== inheritedCreditDays && inheritedCreditDays > 0) {
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
    const availableCredit = Math.max(0, activeCreditLimit - activeCreditUsed);

    const ledgerObj = ledger.toObject ? ledger.toObject() : ledger;

    const query = {
      $or: [
        { ledgerId: ledgerObj._id },
        { partyId: customerId, entityType: 'Customer' }
      ]
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
      .populate('createdBy', 'name username');

    if (isPaginationRequested) {
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      transactionsQuery = transactionsQuery.skip(skip).limit(parseInt(limit, 10));
    }

    const transactions = await transactionsQuery.lean();
    const totalTransactions = await LedgerTransaction.countDocuments(query);

    let totalDebit = 0;
    let totalCredit = 0;

    const allTxnsForSummary = await LedgerTransaction.find(query).lean();
    allTxnsForSummary.forEach(txn => {
      totalDebit += Number(txn.debit || 0);
      totalCredit += Number(txn.credit || 0);
    });

    const rawAddr = customer.address || customer.billToAddress;
    const formattedAddr = typeof rawAddr === 'string'
      ? rawAddr
      : rawAddr && typeof rawAddr === 'object'
      ? [rawAddr.address, rawAddr.city, rawAddr.state, rawAddr.zipCode, rawAddr.country].filter(Boolean).join(', ') || rawAddr.branchName || ''
      : '';

    const statementSummary = {
      customer: {
        id: customer._id,
        customerCode: customer.customerCode || customer.serialNumber,
        shopName: customer.shopName,
        ownerName: customer.ownerName,
        mobile: customer.mobileNo1 || customer.mobile || customer.mobileNo2 || '—',
        email: customer.businessEmail || customer.emailId,
        address: formattedAddr,
        gstin: customer.gstNumber || customer.gstin || customer.GSTNo
      },
      ledgerMaster: {
        ledgerCode: ledgerObj.ledgerCode,
        creditLimit: activeCreditLimit,
        creditDays: ledgerObj.creditDays || inheritedCreditDays,
        creditUsed: activeCreditUsed,
        advanceAmount: activeAdvance,
        availableCredit,
        interestRate: ledgerObj.interestRate || 0,
        openingBalance: ledgerObj.openingBalance || 0,
        openingBalanceType: ledgerObj.openingBalanceType || 'Debit',
        currentBalance: activeCreditUsed > 0 ? activeCreditUsed : -activeAdvance,
        overdueAmount: ledgerObj.overdueAmount || 0,
        ledgerStatus: ledgerObj.ledgerStatus || 'Active',
        allowCreditSales: ledgerObj.allowCreditSales
      },
      statistics: {
        openingBalance: ledgerObj.openingBalance || 0,
        creditUsed: activeCreditUsed,
        advanceAmount: activeAdvance,
        totalDebit,
        totalCredit,
        netMovement: totalDebit - totalCredit,
        closingBalance: activeCreditUsed > 0 ? activeCreditUsed : -activeAdvance
      }
    };

    return sendSuccessResponse(res, 200, {
      summary: statementSummary,
      transactions,
      pagination: isPaginationRequested ? {
        total: totalTransactions,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalTransactions / parseInt(limit, 10))
      } : null
    }, 'Customer statement loaded successfully.');
  } catch (error) {
    console.error('getCustomerLedgerStatement error:', error);
    return sendErrorResponse(res, 500, 'STATEMENT_LOAD_FAILED', error.message);
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
      return sendErrorResponse(res, 400, 'INVALID_VENDOR_ID', 'Invalid vendor ID.');
    }

    const vendor = await Vendor.findById(vendorId).lean();
    if (!vendor) {
      return sendErrorResponse(res, 404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
    }

    const inheritedTerms = parseInt(String(vendor.paymentTerms || 0).replace(/\D/g, ''), 10) || 0;

    let ledger = await VendorLedger.findOne({ vendorId })
      .populate('branchId', 'name address')
      .populate('coaAccountId', 'accountCode accountName');

    if (!ledger) {
      ledger = new VendorLedger({
        ledgerCode: `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
        vendorId,
        vendorCategory: 'Manufacturer',
        paymentTerms: inheritedTerms,
        openingBalance: 0,
        currentOutstanding: 0,
        branchId: null,
        tenantId: req.user?.tenantId || vendor.tenantId || null,
        createdBy: req.user?.id || req.user?._id
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
        { partyId: vendorId, entityType: 'Vendor' }
      ]
    }).sort({ transactionDate: 1, createdAt: 1 }).lean();

    let computedOutstanding = Number(ledger.openingBalance || 0);
    for (const t of allTxnsBalance) {
      computedOutstanding += Number(t.credit || 0);
      computedOutstanding -= Number(t.debit || 0);
    }

    // Sync to DB if different
    if (ledger.currentOutstanding !== computedOutstanding) {
      await VendorLedger.findByIdAndUpdate(ledger._id, { currentOutstanding: computedOutstanding });
      ledger.currentOutstanding = computedOutstanding;
    }

    const ledgerObj = ledger.toObject ? ledger.toObject() : ledger;
    ledgerObj.currentOutstanding = computedOutstanding;


    const query = {
      $or: [
        { ledgerId: ledgerObj._id },
        { partyId: vendorId, entityType: 'Vendor' }
      ]
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
      .populate('createdBy', 'name username');

    if (isPaginationRequested) {
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      transactionsQuery = transactionsQuery.skip(skip).limit(parseInt(limit, 10));
    }

    const transactions = await transactionsQuery.lean();
    const totalTransactions = await LedgerTransaction.countDocuments(query);

    let totalDebit = 0;
    let totalCredit = 0;

    const allTxnsForSummary = await LedgerTransaction.find(query).lean();
    allTxnsForSummary.forEach(txn => {
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
        gstin: vendor.gstNumber || vendor.gstin
      },
      ledgerMaster: {
        ledgerCode: ledgerObj.ledgerCode,
        paymentTerms: ledgerObj.paymentTerms || inheritedTerms,
        openingBalance: ledgerObj.openingBalance || 0,
        openingBalanceType: ledgerObj.openingBalanceType || 'Credit',
        currentOutstanding: computedOutstanding,
        overdueAmount: ledgerObj.overdueAmount || 0,
        ledgerStatus: ledgerObj.ledgerStatus || 'Active'
      },
      statistics: {
        openingBalance: ledgerObj.openingBalance || 0,
        totalDebit,
        totalCredit,
        currentOutstanding: computedOutstanding
      }
    };

    return sendSuccessResponse(res, 200, {
      summary: statementSummary,
      transactions,
      pagination: isPaginationRequested ? {
        total: totalTransactions,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalTransactions / parseInt(limit, 10))
      } : null
    }, 'Vendor statement loaded successfully.');
  } catch (error) {
    console.error('getVendorLedgerStatement error:', error);
    return sendErrorResponse(res, 500, 'VENDOR_STATEMENT_LOAD_FAILED', error.message);
  }
};

/**
 * 3. Get All Customer Ledgers (Khata List - Syncs directly with Customer object)
 */
export const getCustomerLedgersList = async (req, res) => {
  try {
    const { search, status, branchId, page = 1, limit = 50 } = req.query;
    const tenantId = req.user?.tenantId || null;

    const customerQuery = {};
    if (tenantId) {
      customerQuery.tenantId = tenantId;
    }

    if (search) {
      customerQuery.$or = [
        { shopName: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { mobileNo1: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { customerCode: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(customerQuery)
      .select('shopName ownerName mobileNo1 mobileNo2 mobile businessEmail address branchId tenantId creditLimit creditDays creditUsed customerBalance customerCode serialNumber GSTNo gstNumber createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const ledgers = [];
    for (const cust of customers) {
      let l = await CustomerLedger.findOne({ customerId: cust._id })
        .populate('branchId', 'name')
        .populate('coaAccountId', 'accountCode accountName');

      const custCreditLimit = Number(cust.creditLimit || 0);
      const custCreditDays = parseCreditDays(cust.creditDays);
      const custCreditUsed = Number(cust.creditUsed || 0);
      const custAdvance = Number(cust.customerBalance || 0);

      if (!l) {
        l = await CustomerLedger.create({
          ledgerCode: `CUST-LED-${cust._id.toString().slice(-6).toUpperCase()}`,
          customerId: cust._id,
          customerType: 'Wholesale',
          creditLimit: custCreditLimit,
          creditDays: custCreditDays,
          creditUsed: custCreditUsed,
          advanceAmount: custAdvance,
          openingBalance: 0,
          currentBalance: custCreditUsed > 0 ? custCreditUsed : -custAdvance,
          branchId: cust.branchId || null,
          tenantId,
          createdBy: req.user?.id || req.user?._id
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

      cust.mobile = cust.mobileNo1 || cust.mobile || cust.mobileNo2 || '—';
      cust.creditLimit = custCreditLimit;
      cust.creditDays = custCreditDays;
      cust.creditUsed = custCreditUsed;
      cust.customerBalance = custAdvance;

      const activeCreditLimit = custCreditLimit;
      const activeCreditUsed = custCreditUsed;
      const activeAdvance = custAdvance;
      const availableCredit = Math.max(0, activeCreditLimit - activeCreditUsed);

      lObj.customerId = cust;
      lObj.creditLimit = activeCreditLimit;
      lObj.creditDays = lObj.creditDays || custCreditDays;
      lObj.creditUsed = activeCreditUsed;
      lObj.advanceAmount = activeAdvance;
      lObj.availableCredit = availableCredit;
      lObj.currentBalance = activeCreditUsed > 0 ? activeCreditUsed : -activeAdvance;

      if (!status || lObj.ledgerStatus === status) {
        ledgers.push(lObj);
      }
    }

    return sendSuccessResponse(res, 200, {
      ledgers,
      pagination: {
        total: ledgers.length,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(ledgers.length / parseInt(limit, 10))
      }
    }, 'Customer ledgers retrieved successfully.');
  } catch (error) {
    console.error('getCustomerLedgersList error:', error);
    return sendErrorResponse(res, 500, 'GET_CUSTOMER_LEDGERS_FAILED', error.message);
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
        { name: { $regex: search, $options: 'i' } },
        { firm: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const vendors = await Vendor.find(vendorQuery).sort({ createdAt: -1 }).lean();

    const ledgers = [];
    for (const v of vendors) {
      let l = await VendorLedger.findOne({ vendorId: v._id })
        .populate('branchId', 'name')
        .populate('coaAccountId', 'accountCode accountName');

      const vPaymentTerms = parseInt(String(v.paymentTerms || 0).replace(/\D/g, ''), 10) || 0;

      if (!l) {
        l = await VendorLedger.create({
          ledgerCode: `VEND-LED-${v._id.toString().slice(-6).toUpperCase()}`,
          vendorId: v._id,
          paymentTerms: vPaymentTerms,
          openingBalance: 0,
          currentOutstanding: 0,
          branchId: null,
          tenantId,
          createdBy: req.user?.id || req.user?._id
        });
      } else {
        const ledgerId = l._id;
        const txns = await LedgerTransaction.find({
          $or: [
            { ledgerId },
            { partyId: v._id, entityType: 'Vendor' }
          ]
        }).lean();

        let syncedBalance = Number(l.openingBalance || 0);
        txns.forEach(t => {
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

    return sendSuccessResponse(res, 200, {
      ledgers,
      pagination: {
        total: ledgers.length,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(ledgers.length / parseInt(limit, 10))
      }
    }, 'Vendor ledgers retrieved successfully.');
  } catch (error) {
    console.error('getVendorLedgersList error:', error);
    return sendErrorResponse(res, 500, 'GET_VENDOR_LEDGERS_FAILED', error.message);
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
      remarks
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_CUSTOMER_ID', 'Valid customerId is required.');
    }

    let ledger = await CustomerLedger.findOne({ customerId });
    if (!ledger) {
      ledger = new CustomerLedger({
        ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
        customerId,
        currentBalance: Number(openingBalance || 0),
        tenantId,
        createdBy: userId
      });
    }

    if (coaAccountId && mongoose.Types.ObjectId.isValid(coaAccountId)) ledger.coaAccountId = coaAccountId;
    if (customerType) ledger.customerType = customerType;
    if (creditLimit !== undefined) ledger.creditLimit = Number(creditLimit);
    if (creditDays !== undefined) ledger.creditDays = Number(creditDays);
    if (interestRate !== undefined) ledger.interestRate = Number(interestRate);
    if (openingBalance !== undefined) ledger.openingBalance = Number(openingBalance);
    if (openingBalanceType) ledger.openingBalanceType = openingBalanceType;
    if (ledgerStatus) ledger.ledgerStatus = ledgerStatus;
    if (allowCreditSales !== undefined) ledger.allowCreditSales = Boolean(allowCreditSales);
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) ledger.branchId = branchId;
    if (remarks !== undefined) ledger.remarks = remarks;

    await ledger.save();

    if (creditLimit !== undefined || creditDays !== undefined) {
      const custUpdate = {};
      if (creditLimit !== undefined) custUpdate.creditLimit = Number(creditLimit);
      if (creditDays !== undefined) custUpdate['creditDays.name'] = `${creditDays} Days`;
      await Customer.findByIdAndUpdate(customerId, { $set: custUpdate });
    }

    return sendSuccessResponse(res, 200, ledger, 'Customer ledger settings saved.');
  } catch (error) {
    console.error('upsertCustomerLedger error:', error);
    return sendErrorResponse(res, 500, 'UPSERT_CUSTOMER_LEDGER_FAILED', error.message);
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
      remarks
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return sendErrorResponse(res, 400, 'INVALID_VENDOR_ID', 'Valid vendorId is required.');
    }

    let ledger = await VendorLedger.findOne({ vendorId });
    if (!ledger) {
      ledger = new VendorLedger({
        ledgerCode: `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
        vendorId,
        currentOutstanding: Number(openingBalance || 0),
        tenantId,
        createdBy: userId
      });
    }

    if (coaAccountId && mongoose.Types.ObjectId.isValid(coaAccountId)) ledger.coaAccountId = coaAccountId;
    if (gstin) ledger.gstin = gstin;
    if (pan) ledger.pan = pan;
    if (paymentTerms !== undefined) ledger.paymentTerms = Number(paymentTerms);
    if (openingBalance !== undefined) ledger.openingBalance = Number(openingBalance);
    if (openingBalanceType) ledger.openingBalanceType = openingBalanceType;
    if (ledgerStatus) ledger.ledgerStatus = ledgerStatus;
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) ledger.branchId = branchId;
    if (remarks !== undefined) ledger.remarks = remarks;

    await ledger.save();

    if (paymentTerms !== undefined) {
      await Vendor.findByIdAndUpdate(vendorId, { $set: { paymentTerms: `${paymentTerms} Days` } });
    }

    return sendSuccessResponse(res, 200, ledger, 'Vendor ledger settings saved.');
  } catch (error) {
    console.error('upsertVendorLedger error:', error);
    return sendErrorResponse(res, 500, 'UPSERT_VENDOR_LEDGER_FAILED', error.message);
  }
};
