import mongoose from 'mongoose';
import Payment from '../../models/Accounting/Payment.model.js';
import Customer from '../../models/Auth/Customer.js';
import CustomerLedger from '../../models/Accounting/CustomerLedger.model.js';
import LedgerTransaction from '../../models/Accounting/LedgerTransaction.model.js';
import generatePDF from './pdfService.js';
import { generatePaymentReceiptHTML, generatePaymentEmailHTML } from '../../Utils/templates/paymentReceiptTemplate.js';
import { sendEmail } from '../config/Email/emailService.js';

/**
 * Generates the Payment Receipt PDF Buffer for a given payment ID or reference number
 */
export const generatePaymentReceiptPDF = async (paymentId, tenantId) => {
    try {
        const isObjectId = mongoose.Types.ObjectId.isValid(paymentId);
        const pQuery = isObjectId
            ? { $or: [{ _id: paymentId }, { paymentNumber: paymentId }, { 'paymentDetails.referenceNumber': paymentId }] }
            : { paymentNumber: paymentId };

        if (tenantId) pQuery.tenantId = tenantId;

        let payment = await Payment.findOne(pQuery).lean();

        let customer = null;
        let ledger = null;
        let receiptNo = paymentId;
        let receiptDate = new Date();
        let paymentMode = 'CASH';
        let grossAmount = 0;
        let paymentDetails = {};
        let allocations = [];
        let narration = '';

        if (payment) {
            receiptNo = payment.paymentNumber;
            receiptDate = payment.createdAt || new Date();
            paymentMode = payment.paymentMode || 'CASH';
            grossAmount = payment.grossAmount || payment.netAmountPaid || 0;
            paymentDetails = payment.paymentDetails || {};
            allocations = payment.allocations || [];
            narration = payment.paymentDetails?.remarks || '';

            customer = await Customer.findById(payment.partyId).lean();
            ledger = await CustomerLedger.findOne({ customerId: payment.partyId }).lean();
        } else {
            // Fallback: Check LedgerTransaction collection (e.g. for historical transactions)
            const tQuery = isObjectId
                ? { $or: [{ _id: paymentId }, { voucherId: paymentId }, { referenceNumber: paymentId }] }
                : { referenceNumber: paymentId };

            if (tenantId) tQuery.tenantId = tenantId;

            const txn = await LedgerTransaction.findOne(tQuery).lean();
            if (!txn) {
                throw new Error(`Payment or Transaction record '${paymentId}' not found.`);
            }

            receiptNo = txn.referenceNumber;
            receiptDate = txn.transactionDate || txn.createdAt || new Date();
            grossAmount = Number(txn.credit || txn.debit || 0);
            narration = txn.narration || '';

            // Detect payment mode from narration
            const narrUpper = narration.toUpperCase();
            if (narrUpper.includes('UPI')) paymentMode = 'UPI';
            else if (narrUpper.includes('CHEQUE')) paymentMode = 'CHEQUE';
            else if (narrUpper.includes('BANK') || narrUpper.includes('NEFT') || narrUpper.includes('RTGS')) paymentMode = 'BANK_TRANSFER';
            else if (narrUpper.includes('ADVANCE')) paymentMode = 'ADVANCE_ADJUSTMENT';
            else paymentMode = 'CASH';

            customer = await Customer.findById(txn.partyId).lean();
            ledger = await CustomerLedger.findById(txn.ledgerId).lean() || await CustomerLedger.findOne({ customerId: txn.partyId }).lean();

            payment = {
                paymentNumber: receiptNo,
                partyId: txn.partyId,
                partyName: customer?.shopName || customer?.ownerName || 'Customer',
                paymentMode,
                grossAmount,
                createdAt: receiptDate
            };
        }

        if (!customer) {
            customer = {
                shopName: payment?.partyName || 'Valued Customer',
                ownerName: payment?.partyName || 'Customer',
            };
        }

        const remainingCreditUsed = ledger?.creditUsed !== undefined
            ? ledger.creditUsed
            : (customer.creditUsed || (ledger?.currentBalance > 0 ? ledger.currentBalance : 0) || 0);

        const customerBalance = ledger?.advanceAmount !== undefined
            ? ledger.advanceAmount
            : (customer.customerBalance || (ledger?.currentBalance < 0 ? Math.abs(ledger.currentBalance) : 0) || 0);

        const receiptData = {
            receiptNo,
            receiptDate,
            company: {
                name: process.env.COMPANY_NAME || 'DigiOptics Wholesale',
                addressLine1: 'WeWork Eldeco Centre, Block A, Shivalik Colony',
                addressLine2: 'Malviya Nagar, New Delhi, Delhi 110017',
                phone: process.env.COMPANY_PHONE || '+91 9650560526',
                email: process.env.COMPANY_EMAIL || 'support@digioptics.com',
                gstin: process.env.COMPANY_GSTIN || 'GST9876543210',
            },
            customer: {
                shopName: customer.shopName,
                ownerName: customer.ownerName,
                customerCode: customer.customerCode,
                gstNumber: customer.gstNumber,
                mobileNo1: customer.mobileNo1 || customer.mobile,
                businessEmail: customer.businessEmail || customer.email,
                billToAddress: customer.billToAddress,
            },
            paymentMode,
            grossAmount,
            paymentDetails,
            allocations,
            narration,
            accountSummary: {
                remainingCreditUsed,
                customerBalance,
            },
        };

        const html = generatePaymentReceiptHTML(receiptData);
        const pdfBuffer = await generatePDF(html);
        const fileName = `Receipt-${payment.paymentNumber}.pdf`;

        return {
            buffer: pdfBuffer,
            fileName,
            payment,
            customer,
            receiptData,
        };
    } catch (error) {
        console.error('[PaymentReceipt] PDF Generation error:', error);
        throw error;
    }
};

/**
 * Sends a confirmation email to the customer with the Payment Receipt PDF attached
 */
export const sendPaymentReceiptEmail = async ({ paymentId, tenantId }) => {
    try {
        console.log(`[PaymentReceipt] Preparing receipt & email for payment: ${paymentId}`);
        const { buffer, fileName, payment, customer, receiptData } = await generatePaymentReceiptPDF(paymentId, tenantId);

        const recipientEmail = customer.businessEmail || customer.email;
        if (!recipientEmail) {
            console.warn(`[PaymentReceipt] Customer ${customer.shopName || customer._id} does not have an email address configured. Skipping email.`);
            return { success: false, reason: 'NO_EMAIL' };
        }

        const emailHtml = generatePaymentEmailHTML({
            customerName: customer.ownerName,
            shopName: customer.shopName,
            receiptNo: payment.paymentNumber,
            amount: payment.grossAmount || payment.netAmountPaid,
            receiptDate: payment.createdAt,
            paymentMode: payment.paymentMode,
            remainingDue: receiptData.accountSummary.remainingCreditUsed,
            availableAdvance: receiptData.accountSummary.customerBalance,
        });

        const emailResult = await sendEmail({
            to: recipientEmail,
            subject: `Payment Receipt: ₹${payment.grossAmount || payment.netAmountPaid} Received [${payment.paymentNumber}]`,
            html: emailHtml,
            attachments: [
                {
                    name: fileName,
                    content: buffer,
                },
            ],
        });

        console.log(`[PaymentReceipt] Email sent to ${recipientEmail}:`, emailResult);
        return { success: true, emailResult };
    } catch (err) {
        console.error('[PaymentReceipt] Failed to send receipt email:', err.message);
        return { success: false, error: err.message };
    }
};
