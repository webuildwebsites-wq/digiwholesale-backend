import mongoose from 'mongoose';
import Payment from '../../../models/Accounting/Payment.model.js';
import CustomerLedger from '../../../models/Accounting/CustomerLedger.model.js';
import VendorLedger from '../../../models/Accounting/VendorLedger.model.js';
import LedgerTransaction from '../../../models/Accounting/LedgerTransaction.model.js';
import Customer from '../../../models/Auth/Customer.js';
import Vendor from '../../../models/Vendor.model.js';
import BulkOrder from '../../../models/order/BulkOrder.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';
import { generatePaymentReceiptPDF, sendPaymentReceiptEmail } from '../../services/paymentReceiptService.js';

const runInTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (sessErr) {
    console.warn("MongoDB replica set / session not active. Executing sequentially:", sessErr.message);
    session = null;
  }

  try {
    const result = await workFn(session);
    if (session) {
      await session.commitTransaction();
    }
    return result;
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const executeCustomerPayment = async (req, res) => {
  try {
    const {
      customerId,
      branchId,
      amount,
      paymentMode,
      allocations = [],
      paymentDetails = {}
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!customerId || !amount || amount <= 0 || !paymentMode) {
      return sendErrorResponse(res, 400, 'INVALID_INPUT', 'Customer ID, valid positive amount, and payment mode are required.');
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return sendErrorResponse(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
    }

    const result = await runInTransaction(async (session) => {
      let ledger = await CustomerLedger.findOne({ customerId }).session(session);
      if (!ledger) {
        ledger = new CustomerLedger({
          ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
          customerId,
          customerType: customer.customerType || 'Wholesale',
          creditLimit: Number(customer.creditLimit || 0),
          creditUsed: Number(customer.creditUsed || 0),
          advanceAmount: Number(customer.customerBalance || 0),
          openingBalance: 0,
          currentBalance: Number(customer.creditUsed || 0) > 0 ? Number(customer.creditUsed) : -Number(customer.customerBalance || 0),
          branchId: branchId || customer.branchId || null,
          tenantId,
          createdBy: userId
        });
        await ledger.save({ session });
      }

      if (ledger.ledgerStatus === 'Blocked' || ledger.ledgerStatus === 'Closed') {
        throw new Error(`Customer Ledger is currently ${ledger.ledgerStatus}. Transactions not permitted.`);
      }

      let totalAllocated = 0;
      const processedAllocations = [];

      for (const alloc of allocations) {
        if (alloc.allocatedAmount && alloc.allocatedAmount > 0) {
          totalAllocated += Number(alloc.allocatedAmount);
          processedAllocations.push({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber || 'INV-REF',
            invoiceModel: alloc.invoiceModel || 'bulkOrders',
            invoiceTotal: alloc.invoiceTotal || alloc.allocatedAmount,
            allocatedAmount: Number(alloc.allocatedAmount)
          });

          if (alloc.invoiceId && mongoose.Types.ObjectId.isValid(alloc.invoiceId)) {
            await BulkOrder.findByIdAndUpdate(alloc.invoiceId, {
              $inc: { advanceAmount: Number(alloc.allocatedAmount) }
            }, { session }).catch(() => null);
          }
        }
      }

      const grossAmount = Number(amount);
      const initialStatus = 'COMPLETED';

      const existingCreditUsed = Number(
        (ledger.creditUsed !== undefined && ledger.creditUsed !== null)
          ? ledger.creditUsed
          : (customer.creditUsed || (ledger.currentBalance > 0 ? ledger.currentBalance : 0) || 0)
      );

      const existingAdvance = Number(
        (ledger.advanceAmount !== undefined && ledger.advanceAmount !== null)
          ? ledger.advanceAmount
          : (customer.customerBalance || (ledger.currentBalance < 0 ? Math.abs(ledger.currentBalance) : 0) || 0)
      );

      let adjustedFromCreditUsed = 0;
      let remainingCreditUsed = existingCreditUsed;
      let newAdvanceAmount = existingAdvance;

      if (existingCreditUsed > 0) {
        if (grossAmount <= existingCreditUsed) {
          adjustedFromCreditUsed = grossAmount;
          remainingCreditUsed = existingCreditUsed - grossAmount;
        } else {
          adjustedFromCreditUsed = existingCreditUsed;
          remainingCreditUsed = 0;
          newAdvanceAmount = existingAdvance + (grossAmount - existingCreditUsed);
        }
      } else {
        newAdvanceAmount = existingAdvance + grossAmount;
      }

      const newCurrentBalance = remainingCreditUsed > 0 ? remainingCreditUsed : -newAdvanceAmount;

      const paymentNumber = `CPAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const payment = new Payment({
        paymentNumber,
        type: 'CUSTOMER_INFLOW',
        partyId: customerId,
        partyModel: 'Customer',
        partyName: customer.shopName || customer.ownerName || 'Customer',
        paymentMode,
        grossAmount,
        netAmountPaid: grossAmount,
        allocations: processedAllocations,
        advanceAmount: newAdvanceAmount,
        paymentDetails: {
          ...paymentDetails,
          adjustedFromCreditUsed,
          remainingCreditUsed,
          advanceCredited: newAdvanceAmount - existingAdvance,
          collectedByName: req.user?.name || req.user?.username || ''
        },
        status: initialStatus,
        branchId: branchId || ledger.branchId || null,
        tenantId,
        createdBy: userId
      });

      await payment.save({ session });

      ledger.creditUsed = remainingCreditUsed;
      ledger.advanceAmount = newAdvanceAmount;
      ledger.currentBalance = newCurrentBalance;
      await ledger.save({ session });

      await Customer.findByIdAndUpdate(customerId, {
        $set: {
          creditUsed: remainingCreditUsed,
          customerBalance: newAdvanceAmount
        }
      }, { session });

      let narration = `Payment received via ${paymentMode}.`;
      if (paymentMode === 'CHEQUE') {
        narration = `Cheque #${paymentDetails.chequeNumber || 'N/A'} received (Bank: ${paymentDetails.bankName || '—'}, Date: ${paymentDetails.chequeDate || '—'}). ₹${grossAmount.toLocaleString()} credited.`;
        if (adjustedFromCreditUsed > 0) narration += ` Adjusted against Credit Used: ₹${adjustedFromCreditUsed.toLocaleString()}.`;
        if (newAdvanceAmount > existingAdvance) narration += ` Added to Advance: ₹${(newAdvanceAmount - existingAdvance).toLocaleString()}.`;
      } else if (adjustedFromCreditUsed > 0 && newAdvanceAmount > existingAdvance) {
        narration += ` ₹${adjustedFromCreditUsed.toLocaleString()} adjusted against Credit Used. ₹${(newAdvanceAmount - existingAdvance).toLocaleString()} added to Advance.`;
      } else if (adjustedFromCreditUsed > 0) {
        narration += ` ₹${adjustedFromCreditUsed.toLocaleString()} adjusted against Credit Used. Remaining Due: ₹${remainingCreditUsed.toLocaleString()}.`;
      } else {
        narration += ` ₹${grossAmount.toLocaleString()} added to Advance Khata. Total Advance: ₹${newAdvanceAmount.toLocaleString()}.`;
      }

      await LedgerTransaction.create([{
        entityType: 'Customer',
        ledgerId: ledger._id,
        partyId: customerId,
        transactionDate: new Date(),
        voucherType: 'Receipt',
        voucherId: payment._id,
        referenceNumber: payment.paymentNumber,
        credit: grossAmount,
        debit: 0,
        runningBalance: newCurrentBalance,
        narration,
        branchId: payment.branchId,
        tenantId,
        createdBy: userId
      }], { session });

      return payment;
    });

    // Automatically send Payment Receipt confirmation email to customer
    sendPaymentReceiptEmail({ paymentId: result._id, tenantId }).catch(err =>
      console.error('[PaymentReceipt] Background email error:', err.message)
    );

    return sendSuccessResponse(res, 201, result, 'Customer payment processed successfully.');
  } catch (error) {
    console.error('executeCustomerPayment error:', error);
    return sendErrorResponse(res, 500, 'PAYMENT_EXECUTION_FAILED', error.message);
  }
};


export const updateChequeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, bounceReason, clearanceDate } = req.body;
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!['DEPOSITED', 'CLEARED', 'BOUNCED'].includes(status)) {
      return sendErrorResponse(res, 400, 'INVALID_STATUS', 'Status must be DEPOSITED, CLEARED, or BOUNCED.');
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return sendErrorResponse(res, 404, 'PAYMENT_NOT_FOUND', 'Payment record not found.');
    }

    if (payment.paymentMode !== 'CHEQUE') {
      return sendErrorResponse(res, 400, 'INVALID_PAYMENT_MODE', 'Cheque status updates are only valid for CHEQUE payments.');
    }

    const result = await runInTransaction(async (session) => {
      const ledger = await CustomerLedger.findOne({ customerId: payment.partyId }).session(session);
      const customer = await Customer.findById(payment.partyId).session(session);

      if (status === 'CLEARED') {
        payment.status = 'CLEARED';
        payment.paymentDetails.clearanceDate = clearanceDate ? new Date(clearanceDate) : new Date();
        await payment.save({ session });

        if (ledger) {
          await LedgerTransaction.create([{
            entityType: 'Customer',
            ledgerId: ledger._id,
            partyId: payment.partyId,
            transactionDate: payment.paymentDetails.clearanceDate,
            voucherType: 'Receipt',
            voucherId: payment._id,
            referenceNumber: `CLR-${payment.paymentNumber}`,
            credit: 0,
            debit: 0,
            runningBalance: Number(ledger.currentBalance || 0),
            narration: `Cheque #${payment.paymentDetails?.chequeNumber || ''} cleared in bank on ${new Date(payment.paymentDetails.clearanceDate).toLocaleDateString()}. Amount: ₹${Number(payment.grossAmount).toLocaleString()}.`,
            branchId: payment.branchId,
            tenantId,
            createdBy: userId
          }], { session });
        }
      } else if (status === 'BOUNCED') {
        payment.status = 'BOUNCED';
        payment.paymentDetails.bounceReason = bounceReason || 'Cheque bounced / Dishonoured';
        payment.paymentDetails.bounceDate = new Date();
        payment.paymentDetails.bouncePenaltyDebited = 500;
        await payment.save({ session });

        // Unallocate invoices
        if (payment.allocations && payment.allocations.length > 0) {
          for (const alloc of payment.allocations) {
            if (alloc.invoiceId && mongoose.Types.ObjectId.isValid(alloc.invoiceId)) {
              await BulkOrder.findByIdAndUpdate(alloc.invoiceId, {
                $inc: { advanceAmount: -Number(alloc.allocatedAmount) }
              }, { session }).catch(() => null);
            }
          }
        }

        if (ledger) {
          const grossAmount = Number(payment.grossAmount);
          const bounceCharge = 500;

          const restoredCreditUsed = Math.min(
            Number(ledger.creditUsed || 0) + Number(payment.paymentDetails?.adjustedFromCreditUsed || grossAmount),
            Number(ledger.creditUsed || 0) + grossAmount
          );
          const advanceReduction = Math.max(0, Number(ledger.advanceAmount || 0) - (Number(payment.paymentDetails?.advanceCredited || 0)));
          const newCreditUsed = restoredCreditUsed + bounceCharge;
          const newAdvance = advanceReduction;
          const newBalance = newCreditUsed > 0 ? newCreditUsed : -newAdvance;

          ledger.creditUsed = newCreditUsed;
          ledger.advanceAmount = newAdvance;
          ledger.currentBalance = newBalance;
          await ledger.save({ session });

          if (customer) {
            await Customer.findByIdAndUpdate(customer._id, {
              $set: { creditUsed: newCreditUsed, customerBalance: newAdvance }
            }, { session });
          }

          await LedgerTransaction.create([{
            entityType: 'Customer',
            ledgerId: ledger._id,
            partyId: payment.partyId,
            transactionDate: new Date(),
            voucherType: 'Debit Note',
            voucherId: payment._id,
            referenceNumber: `BNC-${payment.paymentNumber}`,
            debit: grossAmount + bounceCharge,
            credit: 0,
            runningBalance: newBalance,
            narration: `Cheque #${payment.paymentDetails?.chequeNumber || 'N/A'} bounced (${payment.paymentDetails.bounceReason}). ₹${grossAmount.toLocaleString()} reversed + ₹${bounceCharge} penalty debited.`,
            branchId: payment.branchId,
            tenantId,
            createdBy: userId
          }], { session });
        }
      } else if (status === 'DEPOSITED') {
        payment.status = 'DEPOSITED';
        payment.paymentDetails.depositDate = new Date();
        await payment.save({ session });
      }

      return payment;
    });

    return sendSuccessResponse(res, 200, result, `Cheque status updated to ${status}.`);
  } catch (error) {
    console.error('updateChequeStatus error:', error);
    return sendErrorResponse(res, 500, 'CHEQUE_STATUS_UPDATE_FAILED', error.message);
  }
};

export const executeVendorPayment = async (req, res) => {
  try {
    const {
      vendorId,
      branchId,
      grossAmount,
      amount,
      paymentMode,
      paymentDetails = {}
    } = req.body;

    const payoutAmount = Number(grossAmount || amount || 0);
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!vendorId || payoutAmount <= 0 || !paymentMode) {
      return sendErrorResponse(res, 400, 'INVALID_INPUT', 'Vendor ID, payment amount, and payment mode are required.');
    }

    const vendor = await Vendor.findById(vendorId).lean();
    if (!vendor) {
      return sendErrorResponse(res, 404, 'VENDOR_NOT_FOUND', 'Vendor not found.');
    }

    const netAmountPaid = payoutAmount;

    const result = await runInTransaction(async (session) => {
      let ledger = await VendorLedger.findOne({ vendorId }).session(session);
      if (!ledger) {
        ledger = new VendorLedger({
          ledgerCode: `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
          vendorId,
          vendorCategory: 'Manufacturer',
          openingBalance: 0,
          currentOutstanding: 0,
          branchId: branchId || null,
          tenantId,
          createdBy: userId
        });
        await ledger.save({ session });
      }

      const paymentNumber = `VPAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const payment = new Payment({
        paymentNumber,
        type: 'VENDOR_OUTFLOW',
        partyId: vendorId,
        partyModel: 'Vendor',
        partyName: vendor.firm || vendor.name || 'Vendor',
        paymentMode,
        grossAmount: payoutAmount,
        tdsDeducted: 0,
        tdsSection: null,
        debitNoteDeducted: 0,
        debitNoteIds: [],
        netAmountPaid,
        paymentDetails: {
          ...paymentDetails,
          paidByName: req.user?.name || req.user?.username || ''
        },
        status: 'COMPLETED',
        branchId: branchId || ledger.branchId || null,
        tenantId,
        createdBy: userId
      });

      await payment.save({ session });

      const newOutstanding = Number(ledger.currentOutstanding) - payoutAmount;
      ledger.currentOutstanding = newOutstanding;
      await ledger.save({ session });

      await LedgerTransaction.create([{
        entityType: 'Vendor',
        ledgerId: ledger._id,
        partyId: vendorId,
        transactionDate: new Date(),
        voucherType: 'Payment Voucher',
        voucherId: payment._id,
        referenceNumber: payment.paymentNumber,
        debit: payoutAmount,
        credit: 0,
        runningBalance: newOutstanding,
        narration: `Payout issued via ${paymentMode}. Amount Paid: ₹${payoutAmount.toLocaleString()}`,
        branchId: payment.branchId,
        tenantId,
        createdBy: userId
      }], { session });

      return payment;
    });

    return sendSuccessResponse(res, 201, result, 'Vendor payout processed successfully.');
  } catch (error) {
    console.error('executeVendorPayment error:', error);
    return sendErrorResponse(res, 500, 'VENDOR_PAYMENT_FAILED', error.message);
  }
};


export const getPaymentsList = async (req, res) => {
  try {
    const { type, paymentMode, status, partyId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const tenantId = req.user?.tenantId || null;

    const query = {};
    if (tenantId) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;
    if (paymentMode) query.paymentMode = paymentMode;
    if (status) query.status = status;
    if (partyId && mongoose.Types.ObjectId.isValid(partyId)) query.partyId = partyId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('branchId', 'name')
      .populate('createdBy', 'name username')
      .lean();

    const total = await Payment.countDocuments(query);

    return sendSuccessResponse(res, 200, {
      payments,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    }, 'Payments retrieved.');
  } catch (error) {
    console.error('getPaymentsList error:', error);
    return sendErrorResponse(res, 500, 'GET_PAYMENTS_FAILED', error.message);
  }
};


export const getPaymentDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id)
      .populate('branchId', 'name address')
      .populate('createdBy', 'name username')
      .lean();

    if (!payment) {
      return sendErrorResponse(res, 404, 'PAYMENT_NOT_FOUND', 'Payment record not found.');
    }

    return sendSuccessResponse(res, 200, payment, 'Payment voucher detail retrieved.');
  } catch (error) {
    return sendErrorResponse(res, 500, 'GET_PAYMENT_DETAIL_FAILED', error.message);
  }
};

export const getPaymentById = getPaymentDetail;


export const adjustDueFromAdvance = async (req, res) => {
  try {
    const { customerId, amount } = req.body;
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return sendErrorResponse(res, 400, 'INVALID_CUSTOMER_ID', 'Valid customerId is required.');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return sendErrorResponse(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
    }

    const currentCreditUsed = Number(customer.creditUsed || 0);
    const currentAdvance = Number(customer.customerBalance || 0);

    if (currentCreditUsed <= 0) {
      return sendErrorResponse(res, 400, 'NO_DUE_TO_ADJUST', 'Customer has no outstanding credit due to adjust.');
    }

    if (currentAdvance <= 0) {
      return sendErrorResponse(res, 400, 'NO_ADVANCE_AVAILABLE', 'Customer has no advance balance available.');
    }

    const maxAdjustable = Math.min(currentCreditUsed, currentAdvance);
    const adjustAmount = (amount && Number(amount) > 0) ? Math.min(Number(amount), maxAdjustable) : maxAdjustable;

    const newCreditUsed = currentCreditUsed - adjustAmount;
    const newAdvance = currentAdvance - adjustAmount;
    const newBalance = newCreditUsed > 0 ? newCreditUsed : -newAdvance;

    customer.creditUsed = newCreditUsed;
    customer.customerBalance = newAdvance;
    await customer.save();

    let ledger = await CustomerLedger.findOne({ customerId });
    if (!ledger) {
      ledger = new CustomerLedger({
        ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
        customerId,
        creditLimit: Number(customer.creditLimit || 0),
        creditDays: Number(customer.creditDays || 30),
        creditUsed: newCreditUsed,
        advanceAmount: newAdvance,
        currentBalance: newBalance,
        branchId: customer.branchId || null,
        tenantId,
        createdBy: userId
      });
    } else {
      ledger.creditUsed = newCreditUsed;
      ledger.advanceAmount = newAdvance;
      ledger.currentBalance = newBalance;
    }
    await ledger.save();

    const refNumber = `ADJ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const adjustmentPayment = new Payment({
      paymentNumber: refNumber,
      type: 'CUSTOMER_INFLOW',
      partyId: customerId,
      partyModel: 'Customer',
      partyName: customer.shopName || customer.ownerName || 'Customer',
      paymentMode: 'ADVANCE_ADJUSTMENT',
      grossAmount: adjustAmount,
      netAmountPaid: adjustAmount,
      advanceAmount: newAdvance,
      paymentDetails: {
        adjustedFromAdvance: adjustAmount,
        previousAdvance: currentAdvance,
        remainingAdvance: newAdvance,
        remarks: 'Advance Jama knocked off against pending Credit Due'
      },
      status: 'COMPLETED',
      branchId: customer.branchId || ledger?.branchId || null,
      tenantId,
      createdBy: userId
    });

    await adjustmentPayment.save();

    await LedgerTransaction.create([{
      entityType: 'Customer',
      ledgerId: ledger._id,
      partyId: customerId,
      transactionDate: new Date(),
      voucherType: 'Journal Voucher',
      voucherId: adjustmentPayment._id,
      referenceNumber: refNumber,
      debit: 0,
      credit: adjustAmount,
      runningBalance: newBalance,
      narration: `₹${adjustAmount.toLocaleString()} Credit Due settled from available Advance Balance of ₹${currentAdvance.toLocaleString()}. Remaining Advance: ₹${newAdvance.toLocaleString()}`,
      branchId: ledger.branchId || null,
      tenantId,
      createdBy: userId
    }]);

    return sendSuccessResponse(res, 200, {
      adjustedAmount: adjustAmount,
      newCreditUsed,
      newAdvance,
      currentBalance: newBalance
    }, `₹${adjustAmount.toLocaleString()} adjusted successfully from customer advance balance.`);
  } catch (error) {
    console.error('adjustDueFromAdvance error:', error);
    return sendErrorResponse(res, 500, 'ADJUST_ADVANCE_FAILED', error.message);
  }
};

/**
 * Downloads / Streams the Payment Receipt PDF for a given payment ID
 */
export const getPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return sendErrorResponse(res, 400, 'INVALID_ID', 'Payment ID or reference number is required.');
    }

    const { buffer, fileName } = await generatePaymentReceiptPDF(id.trim(), req.user?.tenantId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    console.error('getPaymentReceipt error:', error);
    return sendErrorResponse(res, 500, 'RECEIPT_GENERATION_FAILED', error.message);
  }
};

