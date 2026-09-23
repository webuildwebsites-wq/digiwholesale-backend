import mongoose from "mongoose";
import Payment from "../../models/Accounting/Payment.model.js";
import Customer from "../../models/Auth/Customer.js";
import Vendor from "../../models/Vendor.model.js";
import CustomerLedger from "../../models/Accounting/CustomerLedger.model.js";
import VendorLedger from "../../models/Accounting/VendorLedger.model.js";
import LedgerTransaction from "../../models/Accounting/LedgerTransaction.model.js";
import generatePDF from "./pdfService.js";
import {
  generatePaymentReceiptHTML,
  generatePaymentEmailHTML,
  generateVendorPaymentEmailHTML,
} from "../../Utils/templates/paymentReceiptTemplate.js";
import { sendEmail } from "../config/Email/emailService.js";
import {
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  customerPaymentReceivedWhatsApp,
  vendorPaymentDisbursedWhatsApp,
} from "../../Utils/whatsapp/whatsappService.js";

/**
 * Generates the Payment Receipt / Payout Advice PDF Buffer for a given payment ID or reference number
 * Supports both Customer payments (Inflow) and Vendor payouts (Outflow)
 */
export const generatePaymentReceiptPDF = async (paymentId, tenantId) => {
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(paymentId);
    const pQuery = isObjectId
      ? {
          $or: [
            { _id: paymentId },
            { paymentNumber: paymentId },
            { "paymentDetails.referenceNumber": paymentId },
          ],
        }
      : { paymentNumber: paymentId };

    if (tenantId) pQuery.tenantId = tenantId;

    let payment = await Payment.findOne(pQuery).lean();

    let customer = null;
    let vendor = null;
    let ledger = null;
    let receiptNo = paymentId;
    let receiptDate = new Date();
    let paymentMode = "CASH";
    let grossAmount = 0;
    let paymentDetails = {};
    let allocations = [];
    let narration = "";
    let isVendor = false;

    if (payment) {
      receiptNo = payment.paymentNumber;
      receiptDate = payment.createdAt || new Date();
      paymentMode = payment.paymentMode || "CASH";
      grossAmount = payment.grossAmount || payment.netAmountPaid || 0;
      paymentDetails = payment.paymentDetails || {};
      allocations = payment.allocations || [];
      narration = payment.paymentDetails?.remarks || "";
      isVendor =
        payment.partyModel === "Vendor" ||
        payment.type === "VENDOR_OUTFLOW" ||
        payment.paymentNumber?.startsWith("VPAY");

      if (isVendor) {
        vendor = await Vendor.findById(payment.partyId).lean();
        ledger = await VendorLedger.findOne({
          vendorId: payment.partyId,
        }).lean();
      } else {
        customer = await Customer.findById(payment.partyId).lean();
        ledger = await CustomerLedger.findOne({
          customerId: payment.partyId,
        }).lean();

        // Fallback: If customer not found, check if partyId was a Vendor
        if (!customer) {
          const vCheck = await Vendor.findById(payment.partyId).lean();
          if (vCheck) {
            vendor = vCheck;
            ledger = await VendorLedger.findOne({
              vendorId: payment.partyId,
            }).lean();
            isVendor = true;
          }
        }
      }
    } else {
      // Fallback: Check LedgerTransaction collection (e.g. for historical transactions)
      const tQuery = isObjectId
        ? {
            $or: [
              { _id: paymentId },
              { voucherId: paymentId },
              { referenceNumber: paymentId },
            ],
          }
        : { referenceNumber: paymentId };

      if (tenantId) tQuery.tenantId = tenantId;

      const txn = await LedgerTransaction.findOne(tQuery).lean();
      if (!txn) {
        throw new Error(
          `Payment or Transaction record '${paymentId}' not found.`,
        );
      }

      receiptNo = txn.referenceNumber;
      receiptDate = txn.transactionDate || txn.createdAt || new Date();
      grossAmount = Number(txn.credit || txn.debit || 0);
      narration = txn.narration || "";
      isVendor =
        txn.entityType === "Vendor" ||
        txn.voucherType === "Payment Voucher" ||
        txn.referenceNumber?.startsWith("VPAY");

      // Detect payment mode from narration
      const narrUpper = narration.toUpperCase();
      if (narrUpper.includes("UPI")) paymentMode = "UPI";
      else if (narrUpper.includes("CHEQUE")) paymentMode = "CHEQUE";
      else if (
        narrUpper.includes("BANK") ||
        narrUpper.includes("NEFT") ||
        narrUpper.includes("RTGS")
      )
        paymentMode = "BANK_TRANSFER";
      else if (narrUpper.includes("ADVANCE"))
        paymentMode = "ADVANCE_ADJUSTMENT";
      else paymentMode = "CASH";

      if (isVendor) {
        vendor = await Vendor.findById(txn.partyId).lean();
        ledger =
          (await VendorLedger.findById(txn.ledgerId).lean()) ||
          (await VendorLedger.findOne({ vendorId: txn.partyId }).lean());

        payment = {
          paymentNumber: receiptNo,
          partyId: txn.partyId,
          partyName: vendor?.firm || vendor?.name || "Vendor",
          paymentMode,
          grossAmount,
          createdAt: receiptDate,
        };
      } else {
        customer = await Customer.findById(txn.partyId).lean();
        ledger =
          (await CustomerLedger.findById(txn.ledgerId).lean()) ||
          (await CustomerLedger.findOne({ customerId: txn.partyId }).lean());

        payment = {
          paymentNumber: receiptNo,
          partyId: txn.partyId,
          partyName: customer?.shopName || customer?.ownerName || "Customer",
          paymentMode,
          grossAmount,
          createdAt: receiptDate,
        };
      }
    }

    const companyInfo = {
      name: process.env.COMPANY_NAME || "DigiOptics Wholesale",
      addressLine1: "WeWork Eldeco Centre, Block A, Shivalik Colony",
      addressLine2: "Malviya Nagar, New Delhi, Delhi 110017",
      phone: process.env.COMPANY_PHONE || "+91 9650560526",
      email: process.env.COMPANY_EMAIL || "support@digioptics.com",
      gstin: process.env.COMPANY_GSTIN || "GST9876543210",
    };

    let receiptData = {};
    let fileName = "";

    if (isVendor) {
      if (!vendor) {
        vendor = {
          name: payment?.partyName || "Supplier",
          firm: payment?.partyName || "Supplier",
        };
      }

      const currentOutstanding = Number(ledger?.currentOutstanding || 0);

      receiptData = {
        isVendorPayout: true,
        partyType: "Vendor",
        receiptNo,
        receiptDate,
        company: companyInfo,
        vendor: {
          name: vendor.name,
          firm: vendor.firm,
          gstin: vendor.gstNumber || vendor.gstin,
          mobile: vendor.mobile,
          email: vendor.email,
          address: vendor.address,
          paymentTerms: vendor.paymentTerms || ledger?.paymentTerms || 30,
          ledgerCode: ledger?.ledgerCode || "VEND-LED",
        },
        paymentMode,
        grossAmount,
        paymentDetails,
        allocations,
        narration,
        accountSummary: {
          currentOutstanding,
        },
      };

      fileName = `VendorPayout-${receiptNo}.pdf`;
    } else {
      if (!customer) {
        customer = {
          shopName: payment?.partyName || "Valued Customer",
          ownerName: payment?.partyName || "Customer",
        };
      }

      const remainingCreditUsed =
        ledger?.creditUsed !== undefined
          ? ledger.creditUsed
          : customer.creditUsed ||
            (ledger?.currentBalance > 0 ? ledger.currentBalance : 0) ||
            0;

      const customerBalance =
        ledger?.advanceAmount !== undefined
          ? ledger.advanceAmount
          : customer.customerBalance ||
            (ledger?.currentBalance < 0 ? Math.abs(ledger.currentBalance) : 0) ||
            0;

      receiptData = {
        isVendorPayout: false,
        partyType: "Customer",
        receiptNo,
        receiptDate,
        company: companyInfo,
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

      fileName = `Receipt-${receiptNo}.pdf`;
    }

    const html = generatePaymentReceiptHTML(receiptData);
    const pdfBuffer = await generatePDF(html);

    return {
      buffer: pdfBuffer,
      fileName,
      payment,
      customer,
      vendor,
      receiptData,
    };
  } catch (error) {
    console.error("[PaymentReceipt] PDF Generation error:", error);
    throw error;
  }
};

/**
 * Sends a confirmation email to the customer or vendor with the Payment Receipt / Voucher PDF attached
 */
export const sendPaymentReceiptEmail = async ({
  paymentId,
  tenantId,
  cachedPDFData = null,
}) => {
  try {
    console.log(
      `[PaymentReceipt] Preparing receipt & email for payment: ${paymentId}`,
    );
    const { buffer, fileName, payment, customer, vendor, receiptData } =
      cachedPDFData || (await generatePaymentReceiptPDF(paymentId, tenantId));

    // VENDOR PAYOUT EMAIL DISBURSEMENT
    if (receiptData.isVendorPayout) {
      const recipientEmail = vendor?.email;
      if (!recipientEmail) {
        console.warn(
          `[PaymentReceipt] Vendor ${vendor?.firm || vendor?.name || vendor?._id} does not have an email address configured. Skipping email.`,
        );
        return { success: false, reason: "NO_EMAIL" };
      }

      const emailHtml = generateVendorPaymentEmailHTML({
        vendorName: vendor.name,
        firmName: vendor.firm,
        receiptNo: payment.paymentNumber,
        amount: payment.grossAmount || payment.netAmountPaid,
        receiptDate: payment.createdAt,
        paymentMode: payment.paymentMode,
        paymentDetails: receiptData.paymentDetails,
        remainingOutstanding: receiptData.accountSummary.currentOutstanding,
      });

      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: `Payment Advice: ₹${payment.grossAmount || payment.netAmountPaid} Disbursed [${payment.paymentNumber}] - DigiOptics Wholesale`,
        html: emailHtml,
        attachments: [
          {
            name: fileName,
            content: buffer,
          },
        ],
      });

      console.log(
        `[PaymentReceipt] Vendor Payout Email sent to ${recipientEmail}:`,
        emailResult,
      );
      return { success: true, emailResult };
    }

    // CUSTOMER PAYMENT CONFIRMATION
    const recipientEmail = customer?.businessEmail || customer?.email;
    if (!recipientEmail) {
      console.warn(
        `[PaymentReceipt] Customer ${customer?.shopName || customer?._id} does not have an email address configured. Skipping email.`,
      );
      return { success: false, reason: "NO_EMAIL" };
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

    console.log(
      `[PaymentReceipt] Customer Receipt Email sent to ${recipientEmail}:`,
      emailResult,
    );
    return { success: true, emailResult };
  } catch (err) {
    console.error(
      "[PaymentReceipt] Failed to send receipt email:",
      err.message,
    );
    return { success: false, error: err.message };
  }
};

/**
 * Sends a confirmation WhatsApp message (and attached PDF receipt/voucher) to the customer or vendor
 */
export const sendPaymentReceiptWhatsApp = async ({
  paymentId,
  tenantId,
  cachedPDFData = null,
}) => {
  try {
    console.log(
      `[PaymentReceipt] Preparing WhatsApp notification for payment: ${paymentId}`,
    );
    const { buffer, fileName, payment, customer, vendor, receiptData } =
      cachedPDFData || (await generatePaymentReceiptPDF(paymentId, tenantId));

    // 1. VENDOR PAYOUT WHATSAPP NOTIFICATION
    if (receiptData.isVendorPayout) {
      const recipientMobile = vendor?.mobile;
      if (!recipientMobile) {
        console.warn(
          `[PaymentReceipt] Vendor ${vendor?.firm || vendor?.name || vendor?._id} does not have a mobile number configured. Skipping WhatsApp.`,
        );
        return { success: false, reason: "NO_MOBILE" };
      }

      let refInfo = "";
      if (receiptData.paymentDetails?.utrNumber) {
        refInfo = `UTR: ${receiptData.paymentDetails.utrNumber}`;
      } else if (receiptData.paymentDetails?.chequeNumber) {
        refInfo = `Cheque: ${receiptData.paymentDetails.chequeNumber}${
          receiptData.paymentDetails.bankName
            ? ` (${receiptData.paymentDetails.bankName})`
            : ""
        }`;
      } else if (receiptData.paymentDetails?.receiverUpiId) {
        refInfo = `UPI: ${receiptData.paymentDetails.receiverUpiId}`;
      }

      const whatsappText = vendorPaymentDisbursedWhatsApp({
        vendorName: vendor.name,
        firmName: vendor.firm,
        receiptNo: payment.paymentNumber,
        amount: payment.grossAmount || payment.netAmountPaid,
        paymentMode: payment.paymentMode,
        receiptDate: payment.createdAt,
        refInfo,
        remainingOutstanding: receiptData.accountSummary?.currentOutstanding || 0,
        companyName: receiptData.company?.name || "DigiOptics Wholesale",
        companyPhone: receiptData.company?.phone || "+91 9650560526",
      });

      // Try sending with PDF attachment first, fallback to text message
      let whatsappResult = null;
      if (buffer && buffer.length > 0) {
        whatsappResult = await sendWhatsAppMedia({
          to: recipientMobile,
          message: whatsappText,
          fileBuffer: buffer,
          fileName: fileName || `VendorPayout-${payment.paymentNumber}.pdf`,
          mimeType: "application/pdf",
        });
      }

      if (!whatsappResult?.success) {
        console.log(
          `[PaymentReceipt] Media send unconfirmed/failed for vendor WhatsApp, sending text fallback to ${recipientMobile}`,
        );
        whatsappResult = await sendWhatsAppMessage({
          to: recipientMobile,
          message: whatsappText,
        });
      }

      console.log(
        `[PaymentReceipt] Vendor Payout WhatsApp sent to ${recipientMobile}:`,
        whatsappResult,
      );
      return { success: true, whatsappResult };
    }

    // 2. CUSTOMER PAYMENT RECEIPT WHATSAPP NOTIFICATION
    const recipientMobile =
      customer?.mobileNo1 || customer?.mobile || customer?.mobileNo2;
    if (!recipientMobile) {
      console.warn(
        `[PaymentReceipt] Customer ${customer?.shopName || customer?._id} does not have a mobile number configured. Skipping WhatsApp.`,
      );
      return { success: false, reason: "NO_MOBILE" };
    }

    const whatsappText = customerPaymentReceivedWhatsApp({
      customerName: customer.ownerName,
      shopName: customer.shopName,
      receiptNo: payment.paymentNumber,
      amount: payment.grossAmount || payment.netAmountPaid,
      paymentMode: payment.paymentMode,
      receiptDate: payment.createdAt,
      remainingDue: receiptData.accountSummary?.remainingCreditUsed || 0,
      availableAdvance: receiptData.accountSummary?.customerBalance || 0,
      companyName: receiptData.company?.name || "DigiOptics Wholesale",
      companyPhone: receiptData.company?.phone || "+91 9650560526",
    });

    // Try sending with PDF receipt attached, fallback to text message
    let whatsappResult = null;
    if (buffer && buffer.length > 0) {
      whatsappResult = await sendWhatsAppMedia({
        to: recipientMobile,
        message: whatsappText,
        fileBuffer: buffer,
        fileName: fileName || `Receipt-${payment.paymentNumber}.pdf`,
        mimeType: "application/pdf",
      });
    }

    if (!whatsappResult?.success) {
      console.log(
        `[PaymentReceipt] Media send unconfirmed/failed for customer WhatsApp, sending text fallback to ${recipientMobile}`,
      );
      whatsappResult = await sendWhatsAppMessage({
        to: recipientMobile,
        message: whatsappText,
      });
    }

    console.log(
      `[PaymentReceipt] Customer Receipt WhatsApp sent to ${recipientMobile}:`,
      whatsappResult,
    );
    return { success: true, whatsappResult };
  } catch (err) {
    console.error(
      "[PaymentReceipt] Failed to send receipt WhatsApp:",
      err.message,
    );
    return { success: false, error: err.message };
  }
};

/**
 * Dispatches both Email and WhatsApp notifications for a transaction / payment receipt
 */
export const sendPaymentReceiptNotifications = async ({
  paymentId,
  tenantId,
}) => {
  try {
    const pdfData = await generatePaymentReceiptPDF(paymentId, tenantId);

    const [emailRes, whatsappRes] = await Promise.allSettled([
      sendPaymentReceiptEmail({ paymentId, tenantId, cachedPDFData: pdfData }),
      sendPaymentReceiptWhatsApp({
        paymentId,
        tenantId,
        cachedPDFData: pdfData,
      }),
    ]);

    return {
      email:
        emailRes.status === "fulfilled"
          ? emailRes.value
          : { success: false, error: emailRes.reason?.message },
      whatsapp:
        whatsappRes.status === "fulfilled"
          ? whatsappRes.value
          : { success: false, error: whatsappRes.reason?.message },
    };
  } catch (err) {
    console.error(
      "[PaymentReceipt] Failed to dispatch payment notifications:",
      err.message,
    );
    return { success: false, error: err.message };
  }
};
