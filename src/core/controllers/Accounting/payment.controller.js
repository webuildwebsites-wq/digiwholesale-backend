import mongoose from "mongoose";
import Payment from "../../../models/Accounting/Payment.model.js";
import CustomerLedger from "../../../models/Accounting/CustomerLedger.model.js";
import VendorLedger from "../../../models/Accounting/VendorLedger.model.js";
import LedgerTransaction from "../../../models/Accounting/LedgerTransaction.model.js";
import Customer from "../../../models/Auth/Customer.js";
import Vendor from "../../../models/Vendor.model.js";
import BulkOrder from "../../../models/order/BulkOrder.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../../Utils/response/responseHandler.js";
import { calculateBulkOrderTotals, calculateVendorPurchaseTotals } from "./ledger.controller.js";
import {
  generatePaymentReceiptPDF,
  sendPaymentReceiptEmail,
  sendPaymentReceiptWhatsApp,
  sendPaymentReceiptNotifications,
} from "../../services/paymentReceiptService.js";
import {
  sendWhatsAppMessage,
  customerAdvanceAdjustedWhatsApp,
  paymentDueReminderWhatsApp,
} from "../../../Utils/whatsapp/whatsappService.js";
import { sendEmail } from "../../config/Email/emailService.js";

const runInTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (sessErr) {
    console.warn(
      "MongoDB replica set / session not active. Executing sequentially:",
      sessErr.message,
    );
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

export { autoExpireStaleCheques } from "../../services/chequeExpiryService.js";
import { autoExpireStaleCheques } from "../../services/chequeExpiryService.js";

export const executeCustomerPayment = async (req, res) => {
  try {
    const {
      customerId,
      branchId,
      amount,
      paymentMode,
      allocations = [],
      paymentDetails = {},
      isPostDated,
    } = req.body;

    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!customerId || !amount || amount <= 0 || !paymentMode) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_INPUT",
        "Customer ID, valid positive amount, and payment mode are required.",
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
        "Customer registration approval is pending. Payments can only be received for approved customers.",
      );
    }

    const result = await runInTransaction(async (session) => {
      let ledger = await CustomerLedger.findOne({ customerId }).session(
        session,
      );
      if (!ledger) {
        ledger = new CustomerLedger({
          ledgerCode: `CUST-LED-${customerId.toString().slice(-6).toUpperCase()}`,
          customerId,
          customerType: customer.customerType || "Wholesale",
          creditLimit: Number(customer.creditLimit || 0),
          creditUsed: Number(customer.creditUsed || 0),
          advanceAmount: Number(customer.customerBalance || 0),
          openingBalance: 0,
          currentBalance:
            Number(customer.creditUsed || 0) > 0
              ? Number(customer.creditUsed)
              : -Number(customer.customerBalance || 0),
          branchId: branchId || customer.branchId || null,
          tenantId,
          createdBy: userId,
        });
        await ledger.save({ session });
      }

      if (
        ledger.ledgerStatus === "Blocked" ||
        ledger.ledgerStatus === "Closed"
      ) {
        throw new Error(
          `Customer Ledger is currently ${ledger.ledgerStatus}. Transactions not permitted.`,
        );
      }

      let totalAllocated = 0;
      const processedAllocations = [];

      const isPDC = paymentMode === "CHEQUE" && (Boolean(isPostDated) || Boolean(paymentDetails?.isPostDated));

      for (const alloc of allocations) {
        if (alloc.allocatedAmount && Number(alloc.allocatedAmount) > 0) {
          const reqAlloc = Number(alloc.allocatedAmount);
          let safeAlloc = reqAlloc;

          if (alloc.invoiceId && mongoose.Types.ObjectId.isValid(alloc.invoiceId)) {
            const bo = await BulkOrder.findById(alloc.invoiceId).session(session);
            if (bo) {
              const boTotals = calculateBulkOrderTotals(bo);
              const payments = await Payment.find({
                partyId: customerId,
                status: { $ne: "BOUNCED" },
              }).session(session).lean();

              let allocatedSum = 0;
              payments.forEach((p) => {
                (p.allocations || []).forEach((a) => {
                  if (String(a.invoiceId) === String(bo._id)) {
                    allocatedSum += Number(a.allocatedAmount || 0);
                  }
                });
              });

              const initialAdvance = Math.max(0, Number((Number(bo.advanceAmount || 0) - allocatedSum).toFixed(2)));
              const totalPaid = Number((initialAdvance + allocatedSum).toFixed(2));
              const remainingDue = Math.max(0, Number((boTotals.grandTotal - totalPaid).toFixed(2)));

              if (remainingDue <= 0) {
                throw new Error(`Order #${alloc.invoiceNumber || bo._id} is already fully paid. Duplicate payment collection is not permitted.`);
              }
              safeAlloc = Math.min(reqAlloc, remainingDue);
            }
          }

          totalAllocated += safeAlloc;
          processedAllocations.push({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber || "INV-REF",
            invoiceModel: alloc.invoiceModel || "bulkOrders",
            invoiceTotal: alloc.invoiceTotal || safeAlloc,
            allocatedAmount: safeAlloc,
          });

          // Only credit bulkOrder advance immediately if NOT a post-dated cheque
          if (
            !isPDC &&
            alloc.invoiceId &&
            mongoose.Types.ObjectId.isValid(alloc.invoiceId)
          ) {
            await BulkOrder.findByIdAndUpdate(
              alloc.invoiceId,
              {
                $inc: { advanceAmount: safeAlloc },
              },
              { session },
            ).catch(() => null);
          }
        }
      }

      const grossAmount = Number(amount);
      const existingCreditUsed = Number(
        ledger.creditUsed !== undefined && ledger.creditUsed !== null
          ? ledger.creditUsed
          : customer.creditUsed ||
              (ledger.currentBalance > 0 ? ledger.currentBalance : 0) ||
              0,
      );

      const existingAdvance = Number(
        ledger.advanceAmount !== undefined && ledger.advanceAmount !== null
          ? ledger.advanceAmount
          : customer.customerBalance ||
              (ledger.currentBalance < 0
                ? Math.abs(ledger.currentBalance)
                : 0) ||
              0,
      );

      // Post-Dated Cheque branch: Register as PENDING in-hand cheque without immediate balance reduction
      if (isPDC) {
        const paymentNumber = `CPAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        let chequeExpiryDate = null;
        if (paymentDetails?.chequeDate) {
          const exp = new Date(paymentDetails.chequeDate);
          exp.setMonth(exp.getMonth() + 3); // 3 months validity from maturity
          chequeExpiryDate = exp;
        }

        const payment = new Payment({
          paymentNumber,
          type: "CUSTOMER_INFLOW",
          partyId: customerId,
          partyModel: "Customer",
          partyName: customer.shopName || customer.ownerName || "Customer",
          paymentMode,
          grossAmount,
          netAmountPaid: grossAmount,
          allocations: processedAllocations,
          advanceAmount: existingAdvance,
          paymentDetails: {
            ...paymentDetails,
            isPostDated: true,
            chequeStatus: "PENDING",
            chequeExpiryDate,
            retryCount: 0,
            isCredited: false,
            collectedByName: req.user?.name || req.user?.username || "",
          },
          status: "RECEIVED",
          branchId: branchId || ledger.branchId || null,
          tenantId,
          createdBy: userId,
        });

        await payment.save({ session });
        return payment;
      }

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
          newAdvanceAmount =
            existingAdvance + (grossAmount - existingCreditUsed);
        }
      } else {
        newAdvanceAmount = existingAdvance + grossAmount;
      }

      const newCurrentBalance =
        remainingCreditUsed > 0 ? remainingCreditUsed : -newAdvanceAmount;

      const paymentNumber = `CPAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const initialStatus = paymentMode === "CHEQUE" ? "CLEARED" : "COMPLETED";

      const payment = new Payment({
        paymentNumber,
        type: "CUSTOMER_INFLOW",
        partyId: customerId,
        partyModel: "Customer",
        partyName: customer.shopName || customer.ownerName || "Customer",
        paymentMode,
        grossAmount,
        netAmountPaid: grossAmount,
        allocations: processedAllocations,
        advanceAmount: newAdvanceAmount,
        paymentDetails: {
          ...paymentDetails,
          isPostDated: false,
          chequeStatus: paymentMode === "CHEQUE" ? "CLEARED" : "COMPLETED",
          isCredited: true,
          adjustedFromCreditUsed,
          remainingCreditUsed,
          advanceCredited: newAdvanceAmount - existingAdvance,
          collectedByName: req.user?.name || req.user?.username || "",
        },
        status: initialStatus,
        branchId: branchId || ledger.branchId || null,
        tenantId,
        createdBy: userId,
      });

      await payment.save({ session });

      ledger.creditUsed = remainingCreditUsed;
      ledger.advanceAmount = newAdvanceAmount;
      ledger.currentBalance = newCurrentBalance;
      await ledger.save({ session });

      await Customer.findByIdAndUpdate(
        customerId,
        {
          $set: {
            creditUsed: remainingCreditUsed,
            customerBalance: newAdvanceAmount,
          },
        },
        { session },
      );

      let narration = `Payment received via ${paymentMode}.`;
      if (paymentMode === "CHEQUE") {
        narration = `Cheque #${paymentDetails.chequeNumber || "N/A"} received (Bank: ${paymentDetails.bankName || "—"}, Date: ${paymentDetails.chequeDate || "—"}). ₹${grossAmount.toLocaleString()} credited.`;
        if (adjustedFromCreditUsed > 0)
          narration += ` Adjusted against Credit Used: ₹${adjustedFromCreditUsed.toLocaleString()}.`;
        if (newAdvanceAmount > existingAdvance)
          narration += ` Added to Advance: ₹${(newAdvanceAmount - existingAdvance).toLocaleString()}.`;
      } else if (
        adjustedFromCreditUsed > 0 &&
        newAdvanceAmount > existingAdvance
      ) {
        narration += ` ₹${adjustedFromCreditUsed.toLocaleString()} adjusted against Credit Used. ₹${(newAdvanceAmount - existingAdvance).toLocaleString()} added to Advance.`;
      } else if (adjustedFromCreditUsed > 0) {
        narration += ` ₹${adjustedFromCreditUsed.toLocaleString()} adjusted against Credit Used. Remaining Due: ₹${remainingCreditUsed.toLocaleString()}.`;
      } else {
        narration += ` ₹${grossAmount.toLocaleString()} added to Advance Balance. Total Advance: ₹${newAdvanceAmount.toLocaleString()}.`;
      }

      await LedgerTransaction.create(
        [
          {
            entityType: "Customer",
            ledgerId: ledger._id,
            partyId: customerId,
            transactionDate: new Date(),
            voucherType: "Receipt",
            voucherId: payment._id,
            referenceNumber: payment.paymentNumber,
            credit: grossAmount,
            debit: 0,
            runningBalance: newCurrentBalance,
            narration,
            branchId: payment.branchId,
            tenantId,
            createdBy: userId,
          },
        ],
        { session },
      );

      return payment;
    });

    // Send Payment Receipt confirmation Email & WhatsApp only if credited immediately
    if (result.paymentDetails?.isCredited) {
      sendPaymentReceiptNotifications({ paymentId: result._id, tenantId }).catch((err) =>
        console.error("[PaymentReceipt] Background notification error:", err.message),
      );
    }

    const successMsg = result.paymentDetails?.isPostDated
      ? "Post-Dated Cheque recorded successfully as Pending Clearance. Amount will reflect in customer ledger and balance upon cheque clearance."
      : "Customer payment processed successfully.";

    return sendSuccessResponse(
      res,
      201,
      result,
      successMsg,
    );
  } catch (error) {
    console.error("executeCustomerPayment error:", error);
    return sendErrorResponse(
      res,
      500,
      "PAYMENT_EXECUTION_FAILED",
      error.message,
    );
  }
};

export const updateChequeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, bounceReason, clearanceDate } = req.body;
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!["DEPOSITED", "CLEARED", "BOUNCED", "RETRY", "REPRESENTED", "EXPIRED"].includes(status)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_STATUS",
        "Status must be DEPOSITED, CLEARED, BOUNCED, RETRY, or EXPIRED.",
      );
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return sendErrorResponse(
        res,
        404,
        "PAYMENT_NOT_FOUND",
        "Payment record not found.",
      );
    }

    if (payment.paymentMode !== "CHEQUE") {
      return sendErrorResponse(
        res,
        400,
        "INVALID_PAYMENT_MODE",
        "Cheque status updates are only valid for CHEQUE payments.",
      );
    }

    // Auto-expire any stale cheques first
    await autoExpireStaleCheques(tenantId);

    // Guard: Actions cannot be taken until maturity date arrives
    if (["CLEARED", "BOUNCED", "DEPOSITED"].includes(status) && payment.paymentDetails?.isPostDated) {
      const chqDate = payment.paymentDetails?.chequeDate ? new Date(payment.paymentDetails.chequeDate) : null;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (chqDate && chqDate > todayStart) {
        return sendErrorResponse(
          res,
          400,
          "CHEQUE_NOT_YET_MATURED",
          `Cheque #${payment.paymentDetails?.chequeNumber || ""} maturity date is ${chqDate.toLocaleDateString("en-IN")}. Action cannot be taken before maturity date.`,
        );
      }
    }

    const result = await runInTransaction(async (session) => {
      const ledger = await CustomerLedger.findOne({
        customerId: payment.partyId,
      }).session(session);
      const customer = await Customer.findById(payment.partyId).session(
        session,
      );

      const isUncreditedPDC = Boolean(payment.paymentDetails?.isPostDated) && !Boolean(payment.paymentDetails?.isCredited);

      if (status === "CLEARED") {
        const effectiveClearDate = clearanceDate
          ? new Date(clearanceDate)
          : new Date();

        if (isUncreditedPDC) {
          // Post-Dated Cheque cleared: credit allocations to BulkOrders now
          if (payment.allocations && payment.allocations.length > 0) {
            for (const alloc of payment.allocations) {
              if (alloc.invoiceId && mongoose.Types.ObjectId.isValid(alloc.invoiceId)) {
                await BulkOrder.findByIdAndUpdate(
                  alloc.invoiceId,
                  {
                    $inc: { advanceAmount: Number(alloc.allocatedAmount) },
                  },
                  { session },
                ).catch(() => null);
              }
            }
          }

          if (ledger) {
            const grossAmount = Number(payment.grossAmount);
            const existingCreditUsed = Number(
              ledger.creditUsed !== undefined && ledger.creditUsed !== null
                ? ledger.creditUsed
                : customer?.creditUsed ||
                    (ledger.currentBalance > 0 ? ledger.currentBalance : 0) ||
                    0,
            );

            const existingAdvance = Number(
              ledger.advanceAmount !== undefined && ledger.advanceAmount !== null
                ? ledger.advanceAmount
                : customer?.customerBalance ||
                    (ledger.currentBalance < 0
                      ? Math.abs(ledger.currentBalance)
                      : 0) ||
                    0,
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
                newAdvanceAmount =
                  existingAdvance + (grossAmount - existingCreditUsed);
              }
            } else {
              newAdvanceAmount = existingAdvance + grossAmount;
            }

            const newCurrentBalance =
              remainingCreditUsed > 0 ? remainingCreditUsed : -newAdvanceAmount;

            ledger.creditUsed = remainingCreditUsed;
            ledger.advanceAmount = newAdvanceAmount;
            ledger.currentBalance = newCurrentBalance;
            await ledger.save({ session });

            if (customer) {
              await Customer.findByIdAndUpdate(
                customer._id,
                {
                  $set: {
                    creditUsed: remainingCreditUsed,
                    customerBalance: newAdvanceAmount,
                  },
                },
                { session },
              );
            }

            payment.paymentDetails.adjustedFromCreditUsed = adjustedFromCreditUsed;
            payment.paymentDetails.remainingCreditUsed = remainingCreditUsed;
            payment.paymentDetails.advanceCredited = newAdvanceAmount - existingAdvance;

            const bankInfo = payment.paymentDetails?.bankAccountName ? ` (${payment.paymentDetails.bankAccountName})` : '';
            const narration = `Post-Dated Cheque #${payment.paymentDetails?.chequeNumber || 'N/A'} cleared in bank${bankInfo} on ${effectiveClearDate.toLocaleDateString()}. ₹${grossAmount.toLocaleString()} credited.`;

            await LedgerTransaction.create(
              [
                {
                  entityType: "Customer",
                  ledgerId: ledger._id,
                  partyId: payment.partyId,
                  transactionDate: effectiveClearDate,
                  voucherType: "Receipt",
                  voucherId: payment._id,
                  referenceNumber: payment.paymentNumber,
                  credit: grossAmount,
                  debit: 0,
                  runningBalance: newCurrentBalance,
                  narration,
                  branchId: payment.branchId,
                  tenantId,
                  createdBy: userId,
                },
              ],
              { session },
            );
          }

          payment.status = "CLEARED";
          payment.paymentDetails.chequeStatus = "CLEARED";
          payment.paymentDetails.clearanceDate = effectiveClearDate;
          payment.paymentDetails.isCredited = true;
          await payment.save({ session });
        } else {
          payment.status = "CLEARED";
          payment.paymentDetails.chequeStatus = "CLEARED";
          payment.paymentDetails.clearanceDate = effectiveClearDate;
          await payment.save({ session });

          if (ledger) {
            await LedgerTransaction.create(
              [
                {
                  entityType: "Customer",
                  ledgerId: ledger._id,
                  partyId: payment.partyId,
                  transactionDate: effectiveClearDate,
                  voucherType: "Receipt",
                  voucherId: payment._id,
                  referenceNumber: `CLR-${payment.paymentNumber}`,
                  credit: 0,
                  debit: 0,
                  runningBalance: Number(ledger.currentBalance || 0),
                  narration: `Cheque #${payment.paymentDetails?.chequeNumber || ""} cleared in bank on ${effectiveClearDate.toLocaleDateString()}. Amount: ₹${Number(payment.grossAmount).toLocaleString()}.`,
                  branchId: payment.branchId,
                  tenantId,
                  createdBy: userId,
                },
              ],
              { session },
            );
          }
        }
      } else if (status === "BOUNCED") {
        payment.status = "BOUNCED";
        payment.paymentDetails.chequeStatus = "BOUNCED";
        payment.paymentDetails.bounceReason =
          bounceReason || "Cheque bounced / Dishonoured";
        payment.paymentDetails.bounceDate = new Date();
        payment.paymentDetails.bouncePenaltyDebited = 500;
        await payment.save({ session });

        if (isUncreditedPDC) {
          // PDC was NEVER credited into ledger/orders, so do NOT reverse principal grossAmount.
          // Only debit the bounce charge penalty (₹500) to customer ledger.
          if (ledger) {
            const bounceCharge = 500;
            const newCreditUsed = Number(ledger.creditUsed || 0) + bounceCharge;
            const newBalance =
              newCreditUsed > 0 ? newCreditUsed : -Number(ledger.advanceAmount || 0);

            ledger.creditUsed = newCreditUsed;
            ledger.currentBalance = newBalance;
            await ledger.save({ session });

            if (customer) {
              await Customer.findByIdAndUpdate(
                customer._id,
                {
                  $set: {
                    creditUsed: newCreditUsed,
                  },
                },
                { session },
              );
            }

            await LedgerTransaction.create(
              [
                {
                  entityType: "Customer",
                  ledgerId: ledger._id,
                  partyId: payment.partyId,
                  transactionDate: new Date(),
                  voucherType: "Debit Note",
                  voucherId: payment._id,
                  referenceNumber: `BNC-${payment.paymentNumber}`,
                  debit: bounceCharge,
                  credit: 0,
                  runningBalance: newBalance,
                  narration: `Post-Dated Cheque #${payment.paymentDetails?.chequeNumber || "N/A"} bounced (${payment.paymentDetails.bounceReason}). ₹${bounceCharge} penalty debited.`,
                  branchId: payment.branchId,
                  tenantId,
                  createdBy: userId,
                },
              ],
              { session },
            );
          }
        } else {
          // Regular / previously credited cheque: Unallocate orders and reverse grossAmount + penalty
          if (payment.allocations && payment.allocations.length > 0) {
            for (const alloc of payment.allocations) {
              if (
                alloc.invoiceId &&
                mongoose.Types.ObjectId.isValid(alloc.invoiceId)
              ) {
                await BulkOrder.findByIdAndUpdate(
                  alloc.invoiceId,
                  {
                    $inc: { advanceAmount: -Number(alloc.allocatedAmount) },
                  },
                  { session },
                ).catch(() => null);
              }
            }
          }

          if (ledger) {
            const grossAmount = Number(payment.grossAmount);
            const bounceCharge = 500;

            const restoredCreditUsed = Math.min(
              Number(ledger.creditUsed || 0) +
                Number(
                  payment.paymentDetails?.adjustedFromCreditUsed || grossAmount,
                ),
              Number(ledger.creditUsed || 0) + grossAmount,
            );
            const advanceReduction = Math.max(
              0,
              Number(ledger.advanceAmount || 0) -
                Number(payment.paymentDetails?.advanceCredited || 0),
            );
            const newCreditUsed = restoredCreditUsed + bounceCharge;
            const newAdvance = advanceReduction;
            const newBalance = newCreditUsed > 0 ? newCreditUsed : -newAdvance;

            ledger.creditUsed = newCreditUsed;
            ledger.advanceAmount = newAdvance;
            ledger.currentBalance = newBalance;
            await ledger.save({ session });

            if (customer) {
              await Customer.findByIdAndUpdate(
                customer._id,
                {
                  $set: {
                    creditUsed: newCreditUsed,
                    customerBalance: newAdvance,
                  },
                },
                { session },
              );
            }

            await LedgerTransaction.create(
              [
                {
                  entityType: "Customer",
                  ledgerId: ledger._id,
                  partyId: payment.partyId,
                  transactionDate: new Date(),
                  voucherType: "Debit Note",
                  voucherId: payment._id,
                  referenceNumber: `BNC-${payment.paymentNumber}`,
                  debit: grossAmount + bounceCharge,
                  credit: 0,
                  runningBalance: newBalance,
                  narration: `Cheque #${payment.paymentDetails?.chequeNumber || "N/A"} bounced (${payment.paymentDetails.bounceReason}). ₹${grossAmount.toLocaleString()} reversed + ₹${bounceCharge} penalty debited.`,
                  branchId: payment.branchId,
                  tenantId,
                  createdBy: userId,
                },
              ],
              { session },
            );
          }
        }
      } else if (status === "DEPOSITED") {
        payment.status = "DEPOSITED";
        payment.paymentDetails.chequeStatus = "DEPOSITED";
        payment.paymentDetails.depositDate = new Date();
        await payment.save({ session });
      } else if (status === "RETRY" || status === "REPRESENTED") {
        const chqDate = payment.paymentDetails?.chequeDate ? new Date(payment.paymentDetails.chequeDate) : null;
        let expDate = payment.paymentDetails?.chequeExpiryDate ? new Date(payment.paymentDetails.chequeExpiryDate) : null;
        if (!expDate && chqDate) {
          expDate = new Date(chqDate);
          expDate.setMonth(expDate.getMonth() + 3);
        }

        if (expDate && new Date() > expDate) {
          throw new Error(
            `Cheque validity expired on ${expDate.toLocaleDateString("en-IN")} (3 months from maturity date). Stale cheques cannot be retried. Please request a new cheque from the customer.`,
          );
        }

        payment.status = "RECEIVED";
        payment.paymentDetails.chequeStatus = "PENDING";
        payment.paymentDetails.isCredited = false;
        payment.paymentDetails.retryCount = (payment.paymentDetails.retryCount || 0) + 1;
        payment.paymentDetails.lastRetryDate = new Date();
        if (!payment.paymentDetails.retryHistory) {
          payment.paymentDetails.retryHistory = [];
        }
        payment.paymentDetails.retryHistory.push({
          retryDate: new Date(),
          previousStatus: "BOUNCED",
          notes: req.body.notes || req.body.retryNotes || "Cheque re-presented to bank for clearance",
        });
        await payment.save({ session });
      } else if (status === "EXPIRED") {
        payment.status = "EXPIRED";
        payment.paymentDetails.chequeStatus = "EXPIRED";
        await payment.save({ session });
      }

      return payment;
    });

    if (status === "CLEARED") {
      sendPaymentReceiptNotifications({ paymentId: result._id, tenantId }).catch((err) =>
        console.error("[PaymentReceipt] Background notification error:", err.message),
      );
    }

    return sendSuccessResponse(
      res,
      200,
      result,
      `Cheque status updated to ${status}.`,
    );
  } catch (error) {
    console.error("updateChequeStatus error:", error);
    return sendErrorResponse(
      res,
      500,
      "CHEQUE_STATUS_UPDATE_FAILED",
      error.message,
    );
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
      allocations = [],
      paymentDetails = {},
      isPostDated,
    } = req.body;

    const payoutAmount = Number(grossAmount || amount || 0);
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId || null;

    if (!vendorId || payoutAmount <= 0 || !paymentMode) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_INPUT",
        "Vendor ID, payment amount, and payment mode are required.",
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

    const netAmountPaid = payoutAmount;

    const result = await runInTransaction(async (session) => {
      let ledger = await VendorLedger.findOne({ vendorId }).session(session);
      if (!ledger) {
        ledger = new VendorLedger({
          ledgerCode: `VEND-LED-${vendorId.toString().slice(-6).toUpperCase()}`,
          vendorId,
          vendorCategory: "Manufacturer",
          creditLimit: Number(vendor.creditLimit || 0),
          openingBalance: 0,
          currentOutstanding: 0,
          branchId: branchId || null,
          tenantId,
          createdBy: userId,
        });
        await ledger.save({ session });
      }

      if (
        ledger.ledgerStatus === "Blocked" ||
        ledger.ledgerStatus === "Closed"
      ) {
        throw new Error(
          `Vendor Ledger is currently ${ledger.ledgerStatus}. Transactions not permitted.`,
        );
      }

      let totalAllocated = 0;
      const processedAllocations = [];

      for (const alloc of allocations) {
        if (alloc.allocatedAmount && Number(alloc.allocatedAmount) > 0) {
          const reqAlloc = Number(alloc.allocatedAmount);
          let safeAlloc = reqAlloc;

          if (alloc.invoiceId && mongoose.Types.ObjectId.isValid(alloc.invoiceId)) {
            const vp = await VendorPurchase.findById(alloc.invoiceId).session(session);
            if (vp) {
              const vpTotals = calculateVendorPurchaseTotals(vp);
              const payments = await Payment.find({
                partyId: vendorId,
                status: { $ne: "BOUNCED" },
              }).session(session).lean();

              let allocatedSum = 0;
              payments.forEach((p) => {
                (p.allocations || []).forEach((a) => {
                  if (String(a.invoiceId) === String(vp._id)) {
                    allocatedSum += Number(a.allocatedAmount || 0);
                  }
                });
              });

              const remainingDue = Math.max(0, Number((vpTotals.grandTotal - allocatedSum).toFixed(2)));

              if (remainingDue <= 0) {
                throw new Error(`Purchase #${alloc.invoiceNumber || vp._id} is already fully settled. Duplicate payment payout is not permitted.`);
              }
              safeAlloc = Math.min(reqAlloc, remainingDue);
            }
          }

          totalAllocated += safeAlloc;
          processedAllocations.push({
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber || "PUR-REF",
            invoiceModel: "VendorPurchase",
            invoiceTotal: alloc.invoiceTotal || safeAlloc,
            allocatedAmount: safeAlloc,
          });
        }
      }

      const paymentNumber = `VPAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const newOutstanding = Number(ledger.currentOutstanding) - payoutAmount;
      const advanceAmount = newOutstanding < 0 ? Math.abs(newOutstanding) : 0;

      const payment = new Payment({
        paymentNumber,
        type: "VENDOR_OUTFLOW",
        partyId: vendorId,
        partyModel: "Vendor",
        partyName: vendor.firm || vendor.name || "Vendor",
        paymentMode,
        grossAmount: payoutAmount,
        tdsDeducted: 0,
        tdsSection: null,
        debitNoteDeducted: 0,
        debitNoteIds: [],
        netAmountPaid,
        allocations: processedAllocations,
        advanceAmount,
        paymentDetails: {
          ...paymentDetails,
          totalAllocated,
          paidByName: req.user?.name || req.user?.username || "",
        },
        status: "COMPLETED",
        branchId: branchId || ledger.branchId || null,
        tenantId,
        createdBy: userId,
      });

      await payment.save({ session });

      ledger.currentOutstanding = newOutstanding;
      await ledger.save({ session });

      let narration = `Payout issued via ${paymentMode}. Amount Paid: ₹${payoutAmount.toLocaleString()}`;
      if (processedAllocations.length > 0) {
        narration += ` | Settled across ${processedAllocations.length} purchase(s): ${processedAllocations.map((a) => `${a.invoiceNumber} (₹${a.allocatedAmount.toLocaleString()})`).join(", ")}`;
      }

      await LedgerTransaction.create(
        [
          {
            entityType: "Vendor",
            ledgerId: ledger._id,
            partyId: vendorId,
            transactionDate: new Date(),
            voucherType: "Payment Voucher",
            voucherId: payment._id,
            referenceNumber: payment.paymentNumber,
            debit: payoutAmount,
            credit: 0,
            runningBalance: newOutstanding,
            narration,
            branchId: payment.branchId,
            tenantId,
            createdBy: userId,
          },
        ],
        { session },
      );

      return payment;
    });

    // Asynchronously dispatch Payment Advice / Payout Receipt Email & WhatsApp to Vendor
    sendPaymentReceiptNotifications({ paymentId: result._id, tenantId }).catch((err) =>
      console.error("[PaymentReceipt] Vendor background notification error:", err.message),
    );

    return sendSuccessResponse(
      res,
      201,
      result,
      "Vendor payout processed successfully. Payment advice receipt sent via Email & WhatsApp.",
    );
  } catch (error) {
    console.error("executeVendorPayment error:", error);
    return sendErrorResponse(res, 500, "VENDOR_PAYMENT_FAILED", error.message);
  }
};

export const getPaymentsList = async (req, res) => {
  try {
    const {
      type,
      paymentMode,
      status,
      partyId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;
    const tenantId = req.user?.tenantId || null;

    const query = {};
    if (tenantId) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;
    if (paymentMode) query.paymentMode = paymentMode;
    if (status) query.status = status;
    if (partyId && mongoose.Types.ObjectId.isValid(partyId))
      query.partyId = partyId;

    if (req.query.isPostDated !== undefined && req.query.isPostDated !== "") {
      query["paymentDetails.isPostDated"] = req.query.isPostDated === "true";
    }
    if (req.query.chequeStatus) {
      query["paymentDetails.chequeStatus"] = req.query.chequeStatus;
    }

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
      .populate("branchId", "name")
      .populate("createdBy", "name username")
      .lean();

    const total = await Payment.countDocuments(query);

    return sendSuccessResponse(
      res,
      200,
      {
        payments,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
      "Payments retrieved.",
    );
  } catch (error) {
    console.error("getPaymentsList error:", error);
    return sendErrorResponse(res, 500, "GET_PAYMENTS_FAILED", error.message);
  }
};

export const getPdcChequeAlerts = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || null;

    // Automatically expire any stale cheques in the DB before querying
    await autoExpireStaleCheques(tenantId);

    const query = {
      paymentMode: "CHEQUE",
      "paymentDetails.isPostDated": true,
      "paymentDetails.isCredited": false,
      "paymentDetails.chequeStatus": { $nin: ["CLEARED", "CANCELLED"] },
      status: { $nin: ["CLEARED", "CANCELLED"] },
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const pendingPdcCheques = await Payment.find(query)
      .sort({ "paymentDetails.chequeDate": 1, createdAt: -1 })
      .lean();

    const alerts = pendingPdcCheques.map((item) => {
      const chqDate = item.paymentDetails?.chequeDate ? new Date(item.paymentDetails.chequeDate) : null;
      let expDate = item.paymentDetails?.chequeExpiryDate ? new Date(item.paymentDetails.chequeExpiryDate) : null;
      if (!expDate && chqDate) {
        expDate = new Date(chqDate);
        expDate.setMonth(expDate.getMonth() + 3);
      }

      const isMatured = chqDate ? chqDate <= todayEnd : true;
      const isExpired = item.status === "EXPIRED" || item.paymentDetails?.chequeStatus === "EXPIRED" || Boolean(expDate && new Date() > expDate);
      const isBounced = item.status === "BOUNCED" || item.paymentDetails?.chequeStatus === "BOUNCED";
      const canRetry = isBounced && !isExpired;
      const daysDiff = chqDate ? Math.ceil((chqDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const daysUntilExpiry = expDate ? Math.max(0, Math.ceil((expDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const isExpiringSoon = !isExpired && daysUntilExpiry <= 15;

      let urgency = "UPCOMING";
      let message = "";
      if (isExpired) {
        urgency = "EXPIRED";
        message = `Cheque expired on ${expDate.toLocaleDateString("en-IN")} (>3 months). Stale cheque cannot be processed.`;
      } else if (isExpiringSoon) {
        urgency = "EXPIRING_SOON";
        message = `Warning: Cheque will expire on ${expDate.toLocaleDateString("en-IN")} (${daysUntilExpiry} days remaining). Action required before 3-month RBI deadline!`;
      } else if (isBounced) {
        urgency = "BOUNCED";
        message = `Cheque bounced (${item.paymentDetails?.bounceReason || "Dishonoured"}). Valid for retry until ${expDate ? expDate.toLocaleDateString("en-IN") : "3 months"}.`;
      } else if (isMatured) {
        if (daysDiff === 0) {
          urgency = "DUE_TODAY";
          message = "Cheque maturity date is today. Verify if cleared or bounced.";
        } else {
          urgency = "OVERDUE";
          message = `Cheque was due on ${chqDate.toLocaleDateString("en-IN")}. Please confirm if cleared or bounced.`;
        }
      } else {
        urgency = "UPCOMING";
        message = `Cheque is maturing in ${daysDiff} day${daysDiff > 1 ? "s" : ""} (${chqDate.toLocaleDateString("en-IN")}). Actions will unlock on maturity.`;
      }

      return {
        _id: item._id,
        paymentId: item._id,
        paymentNumber: item.paymentNumber,
        partyId: item.partyId,
        partyModel: item.partyModel || "Customer",
        partyName: item.partyName || "Customer",
        grossAmount: item.grossAmount,
        amount: item.grossAmount,
        chequeNumber: item.paymentDetails?.chequeNumber || "",
        chequeDate: item.paymentDetails?.chequeDate || null,
        chequeExpiryDate: expDate,
        daysUntilExpiry,
        isExpired,
        isBounced,
        canRetry,
        isExpiringSoon,
        retryCount: item.paymentDetails?.retryCount || 0,
        lastRetryDate: item.paymentDetails?.lastRetryDate || null,
        bounceReason: item.paymentDetails?.bounceReason || "",
        bankName: item.paymentDetails?.bankName || "",
        bankAccountName: item.paymentDetails?.bankAccountName || "",
        bankAccountNumber: item.paymentDetails?.bankAccountNumber || "",
        receiverUpiId: item.paymentDetails?.receiverUpiId || "",
        allocations: (item.allocations || []).map((a) => ({
          orderNumber: a.invoiceNumber,
          orderId: a.invoiceId,
          allocatedAmount: a.allocatedAmount,
        })),
        isMatured,
        urgency,
        message,
        daysDiff,
        status: isExpired ? "EXPIRED" : item.status,
        chequeStatus: isExpired ? "EXPIRED" : item.paymentDetails?.chequeStatus || "PENDING",
        createdAt: item.createdAt,
      };
    });

    const maturedAlerts = alerts.filter((a) => a.isMatured && !a.isBounced && !a.isExpired);
    const bouncedAlerts = alerts.filter((a) => a.isBounced && !a.isExpired);
    const expiringSoonAlerts = alerts.filter((a) => a.isExpiringSoon && !a.isExpired);
    const upcomingAlerts = alerts.filter((a) => !a.isMatured && !a.isBounced && !a.isExpired);
    const expiredAlerts = alerts.filter((a) => a.isExpired);

    return sendSuccessResponse(
      res,
      200,
      {
        total: alerts.length,
        maturedCount: maturedAlerts.length,
        bouncedCount: bouncedAlerts.length,
        expiringSoonCount: expiringSoonAlerts.length,
        upcomingCount: upcomingAlerts.length,
        expiredCount: expiredAlerts.length,
        alerts,
        maturedAlerts,
        bouncedAlerts,
        expiringSoonAlerts,
        upcomingAlerts,
        expiredAlerts,
      },
      "PDC cheque alerts retrieved.",
    );
  } catch (error) {
    console.error("getPdcChequeAlerts error:", error);
    return sendErrorResponse(res, 500, "GET_PDC_ALERTS_FAILED", error.message);
  }
};

export const getPaymentDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id)
      .populate("branchId", "name address")
      .populate("createdBy", "name username")
      .lean();

    if (!payment) {
      return sendErrorResponse(
        res,
        404,
        "PAYMENT_NOT_FOUND",
        "Payment record not found.",
      );
    }

    return sendSuccessResponse(
      res,
      200,
      payment,
      "Payment voucher detail retrieved.",
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      500,
      "GET_PAYMENT_DETAIL_FAILED",
      error.message,
    );
  }
};

export const getPaymentById = getPaymentDetail;

export const adjustDueFromAdvance = async (req, res) => {
  try {
    const { customerId, amount } = req.body;
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

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return sendErrorResponse(
        res,
        404,
        "CUSTOMER_NOT_FOUND",
        "Customer not found.",
      );
    }

    const currentCreditUsed = Number(customer.creditUsed || 0);
    const currentAdvance = Number(customer.customerBalance || 0);

    if (currentCreditUsed <= 0) {
      return sendErrorResponse(
        res,
        400,
        "NO_DUE_TO_ADJUST",
        "Customer has no outstanding credit due to adjust.",
      );
    }

    if (currentAdvance <= 0) {
      return sendErrorResponse(
        res,
        400,
        "NO_ADVANCE_AVAILABLE",
        "Customer has no advance balance available.",
      );
    }

    const maxAdjustable = Math.min(currentCreditUsed, currentAdvance);
    const adjustAmount =
      amount && Number(amount) > 0
        ? Math.min(Number(amount), maxAdjustable)
        : maxAdjustable;

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
        createdBy: userId,
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
      type: "CUSTOMER_INFLOW",
      partyId: customerId,
      partyModel: "Customer",
      partyName: customer.shopName || customer.ownerName || "Customer",
      paymentMode: "ADVANCE_ADJUSTMENT",
      grossAmount: adjustAmount,
      netAmountPaid: adjustAmount,
      advanceAmount: newAdvance,
      paymentDetails: {
        adjustedFromAdvance: adjustAmount,
        previousAdvance: currentAdvance,
        remainingAdvance: newAdvance,
        remarks: "Advance Jama knocked off against pending Credit Due",
      },
      status: "COMPLETED",
      branchId: customer.branchId || ledger?.branchId || null,
      tenantId,
      createdBy: userId,
    });

    await adjustmentPayment.save();

    await LedgerTransaction.create([
      {
        entityType: "Customer",
        ledgerId: ledger._id,
        partyId: customerId,
        transactionDate: new Date(),
        voucherType: "Journal Voucher",
        voucherId: adjustmentPayment._id,
        referenceNumber: refNumber,
        debit: 0,
        credit: adjustAmount,
        runningBalance: newBalance,
        narration: `₹${adjustAmount.toLocaleString()} Credit Due settled from available Advance Balance of ₹${currentAdvance.toLocaleString()}. Remaining Advance: ₹${newAdvance.toLocaleString()}`,
        branchId: ledger.branchId || null,
        tenantId,
        createdBy: userId,
      },
    ]);

    // Dispatch WhatsApp notification to customer about advance balance adjustment
    const customerMobile = customer.mobileNo1 || customer.mobile || customer.mobileNo2;
    if (customerMobile) {
      const waMsg = customerAdvanceAdjustedWhatsApp({
        customerName: customer.ownerName,
        shopName: customer.shopName,
        refNumber,
        adjustedAmount: adjustAmount,
        remainingDue: newCreditUsed,
        remainingAdvance: newAdvance,
        companyName: process.env.COMPANY_NAME || "DigiOptics Wholesale",
        companyPhone: process.env.COMPANY_PHONE || "+91 9650560526",
      });
      sendWhatsAppMessage({ to: customerMobile, message: waMsg }).catch((err) =>
        console.error("[AdvanceAdjustment] WhatsApp error:", err.message),
      );
    }

    return sendSuccessResponse(
      res,
      200,
      {
        adjustedAmount: adjustAmount,
        newCreditUsed,
        newAdvance,
        currentBalance: newBalance,
      },
      `₹${adjustAmount.toLocaleString()} adjusted successfully from customer advance balance.`,
    );
  } catch (error) {
    console.error("adjustDueFromAdvance error:", error);
    return sendErrorResponse(res, 500, "ADJUST_ADVANCE_FAILED", error.message);
  }
};

/**
 * Downloads / Streams the Payment Receipt PDF for a given payment ID
 */
export const getPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !id.trim()) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_ID",
        "Payment ID or reference number is required.",
      );
    }

    const { buffer, fileName } = await generatePaymentReceiptPDF(
      id.trim(),
      req.user?.tenantId,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error) {
    console.error("getPaymentReceipt error:", error);
    return sendErrorResponse(
      res,
      500,
      "RECEIPT_GENERATION_FAILED",
      error.message,
    );
  }
};

/**
 * Sends a Payment Due Reminder to Customer or Vendor via WhatsApp and Email
 */
export const sendPaymentDueReminder = async (req, res) => {
  try {
    const { partyId, customerId, vendorId, entityType = "Customer" } = req.body;
    const targetPartyId = partyId || customerId || vendorId;
    const tenantId = req.user?.tenantId || null;

    if (!targetPartyId || !mongoose.Types.ObjectId.isValid(targetPartyId)) {
      return sendErrorResponse(
        res,
        400,
        "INVALID_PARTY_ID",
        "Valid customer or vendor ID is required.",
      );
    }

    const isCustomer = entityType.toLowerCase() !== "vendor";

    if (isCustomer) {
      const customer = await Customer.findById(targetPartyId);
      if (!customer) {
        return sendErrorResponse(res, 404, "CUSTOMER_NOT_FOUND", "Customer not found.");
      }

      const ledger = await CustomerLedger.findOne({ customerId: targetPartyId });
      const dueAmount = Number(
        ledger?.creditUsed !== undefined
          ? ledger.creditUsed
          : customer.creditUsed ||
            (ledger?.currentBalance > 0 ? ledger.currentBalance : 0) ||
            0,
      );

      const overdueAmount = Number(ledger?.overdueAmount || 0);
      const creditDays = Number(ledger?.creditDays || customer.creditDays || 30);
      const shopOrCustomerName = customer.shopName || customer.ownerName || "Valued Customer";
      const recipientMobile = customer.mobileNo1 || customer.mobile || customer.mobileNo2;
      const recipientEmail = customer.businessEmail || customer.email;

      if (dueAmount <= 0) {
        return sendErrorResponse(
          res,
          400,
          "NO_DUE_BALANCE",
          `Customer ${shopOrCustomerName} has no outstanding balance due (Balance: ₹0.00).`,
        );
      }

      const companyName = process.env.COMPANY_NAME || "DigiOptics Wholesale";
      const companyPhone = process.env.COMPANY_PHONE || "+91 9650560526";

      const waReminderMessage = paymentDueReminderWhatsApp({
        partyName: shopOrCustomerName,
        isVendor: false,
        totalDue: dueAmount,
        overdueAmount,
        creditDays,
        companyName,
        companyPhone,
      });

      let whatsappSent = false;
      let emailSent = false;
      let waError = null;
      let mailError = null;

      if (recipientMobile) {
        const waRes = await sendWhatsAppMessage({
          to: recipientMobile,
          message: waReminderMessage,
        });
        whatsappSent = Boolean(waRes?.success);
        if (!waRes?.success) waError = waRes?.error || "Failed to send WhatsApp";
      }

      if (recipientEmail) {
        const mailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1f618d; padding: 20px; text-align: center; color: #fff;">
              <h2 style="margin:0;">${companyName}</h2>
              <p style="margin:4px 0 0; font-size: 13px;">Payment Due & Statement Reminder</p>
            </div>
            <div style="padding: 24px; color: #334155;">
              <p>Dear <strong>${shopOrCustomerName}</strong>,</p>
              <p>This is a gentle reminder regarding your outstanding balance with <strong>${companyName}</strong>.</p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 18px 0; text-align: center;">
                <div style="font-size: 12px; color: #991b1b; font-weight: bold;">TOTAL OUTSTANDING DUE</div>
                <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin: 6px 0;">₹${dueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                ${overdueAmount > 0 ? `<div style="font-size: 12px; color: #b91c1c;">Overdue: ₹${overdueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>` : ""}
              </div>
              <p style="font-size: 13px; color: #64748b;">Credit Terms: <strong>${creditDays} Days</strong></p>
              <p style="font-size: 13px; line-height: 1.5;">Kindly arrange for the clearance of this balance at your earliest convenience. If you have already made the payment, please share the transaction receipt with us.</p>
              <p style="font-size: 13px; color: #64748b; margin-top: 20px;">For payment queries or statements, contact us at ${companyPhone} or email <a href="mailto:${process.env.COMPANY_EMAIL || "support@digioptics.com"}">${process.env.COMPANY_EMAIL || "support@digioptics.com"}</a>.</p>
            </div>
          </div>
        `;
        const mailRes = await sendEmail({
          to: recipientEmail,
          subject: `Payment Due Reminder: ₹${dueAmount.toLocaleString("en-IN")} Outstanding - ${companyName}`,
          html: mailHtml,
        });
        emailSent = Boolean(mailRes?.success);
        if (!mailRes?.success) mailError = mailRes?.error;
      }

      return sendSuccessResponse(
        res,
        200,
        {
          partyId: targetPartyId,
          partyName: shopOrCustomerName,
          dueAmount,
          recipientMobile: recipientMobile || null,
          recipientEmail: recipientEmail || null,
          whatsappSent,
          emailSent,
          waError,
          mailError,
        },
        `Payment due reminder processed. WhatsApp: ${whatsappSent ? "Sent" : "Skipped/Failed"}, Email: ${emailSent ? "Sent" : "Skipped/Failed"}.`,
      );
    } else {
      // Vendor payment / statement notification
      const vendor = await Vendor.findById(targetPartyId);
      if (!vendor) {
        return sendErrorResponse(res, 404, "VENDOR_NOT_FOUND", "Vendor not found.");
      }
      const vLedger = await VendorLedger.findOne({ vendorId: targetPartyId });
      const currentOutstanding = Number(vLedger?.currentOutstanding || 0);

      const companyName = process.env.COMPANY_NAME || "DigiOptics Wholesale";
      const companyPhone = process.env.COMPANY_PHONE || "+91 9650560526";

      const waReminderMessage = paymentDueReminderWhatsApp({
        partyName: vendor.firm || vendor.name || "Valued Supplier",
        isVendor: true,
        totalDue: currentOutstanding,
        overdueAmount: Number(vLedger?.overdueAmount || 0),
        creditDays: Number(vLedger?.paymentTerms || vendor.paymentTerms || 30),
        companyName,
        companyPhone,
      });

      let whatsappSent = false;
      if (vendor.mobile) {
        const waRes = await sendWhatsAppMessage({
          to: vendor.mobile,
          message: waReminderMessage,
        });
        whatsappSent = Boolean(waRes?.success);
      }

      return sendSuccessResponse(
        res,
        200,
        {
          partyId: targetPartyId,
          partyName: vendor.firm || vendor.name,
          currentOutstanding,
          recipientMobile: vendor.mobile || null,
          whatsappSent,
        },
        `Vendor notification processed. WhatsApp: ${whatsappSent ? "Sent" : "Skipped/Failed"}.`,
      );
    }
  } catch (error) {
    console.error("sendPaymentDueReminder error:", error);
    return sendErrorResponse(res, 500, "DUE_REMINDER_FAILED", error.message);
  }
};

/**
 * Resends a Payment Receipt / Payout Advice via WhatsApp & Email
 */
export const resendPaymentReceiptNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { channel = "both" } = req.body || {}; // 'whatsapp', 'email', 'both'
    const tenantId = req.user?.tenantId || null;

    if (!id || typeof id !== "string" || !id.trim()) {
      return sendErrorResponse(res, 400, "INVALID_ID", "Payment ID is required.");
    }

    let result = null;
    if (channel === "whatsapp") {
      result = await sendPaymentReceiptWhatsApp({ paymentId: id.trim(), tenantId });
    } else if (channel === "email") {
      result = await sendPaymentReceiptEmail({ paymentId: id.trim(), tenantId });
    } else {
      result = await sendPaymentReceiptNotifications({ paymentId: id.trim(), tenantId });
    }

    return sendSuccessResponse(
      res,
      200,
      result,
      "Payment receipt notification dispatched successfully.",
    );
  } catch (error) {
    console.error("resendPaymentReceiptNotification error:", error);
    return sendErrorResponse(res, 500, "RESEND_FAILED", error.message);
  }
};
