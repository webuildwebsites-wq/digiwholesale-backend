import axios from "axios";
import dotenv from "dotenv";
import FormData from "form-data";
dotenv.config();

const WHATSAPP_BASE_URL    = process.env.WHATSAPP_BASE_URL    || "https://digiwppconnect-backend.digibysr.in";
const WHATSAPP_DEVICE_TOKEN = process.env.WHATSAPP_DEVICE_TOKEN || "cc759a15-f9e5-4f46-8604-6c26ed9ecdcd";
const WHATSAPP_JWT_TOKEN   = process.env.WHATSAPP_JWT_TOKEN   || "wpp_62a1fd8d656a8511c18d0eef3a42646fd0d2119285135c9d32619d6ab1aaa00f798fdc7aa485bf16e38341f0780b8d83";

const SEND_URL       = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send`;
const SEND_MEDIA_URL = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send-media`;

export const formatPhone = (mobile) => {
  const cleaned = String(mobile || "").replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
};

const fmtInr = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const sendWhatsAppMessage = async ({ to, message }) => {
  try {
    const number = formatPhone(to);
    if (!number) {
      console.warn("sendWhatsAppMessage: No valid mobile number provided");
      return { success: false, reason: "INVALID_PHONE" };
    }

    const response = await axios.post(
      SEND_URL,
      { number, message },
      {
        headers: {
          "Content-Type": "application/json",
          ...(WHATSAPP_JWT_TOKEN && { Authorization: `Bearer ${WHATSAPP_JWT_TOKEN}` }),
        },
      }
    );

    console.log(`WhatsApp sent to ${number}:`, response.data);
    return { success: true, result: response.data?.result };
  } catch (error) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

export const sendWhatsAppMedia = async ({
  to,
  phone,
  message = "",
  fileBuffer,
  fileName = "document.pdf",
  mimeType = "application/pdf",
}) => {
  try {
    const target = to || phone;
    const number = formatPhone(target);
    if (!number) {
      console.warn("sendWhatsAppMedia: No valid mobile number provided");
      return { success: false, reason: "INVALID_PHONE" };
    }

    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const form = new FormData();
    form.append("number", number);
    form.append("message", message);
    form.append("media", buffer, {
      filename: fileName,
      contentType: mimeType,
      knownLength: buffer.length,
    });

    const response = await axios.post(SEND_MEDIA_URL, form, {
      headers: {
        ...form.getHeaders(),
        ...(WHATSAPP_JWT_TOKEN && { Authorization: `Bearer ${WHATSAPP_JWT_TOKEN}` }),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    console.log(`WhatsApp media sent to ${number}:`, response.data);
    return { success: true, result: response.data?.result };
  } catch (error) {
    console.error("WhatsApp media error:", error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

export const vendorRegistrationWhatsApp = ({ name, firm, mobile, email }) =>
  `Hello ${name} 👋,

You have been successfully registered as a vendor on *DigiOptics Wholesale*.

*Your Details:*
• Firm Name: ${firm}
• Mobile: ${mobile}
• Email: ${email}

Our team will reach out to you shortly. For any queries, please contact us.

Thank you,
*DigiOptics Wholesale Team*`;

export const vendorNewOrderWhatsApp = ({ vendorName, purchaseOrderId, orderDate, totalOrders, totalItems }) =>
  `Hello ${vendorName} 👋,

A *New Purchase Order* has been placed with you on *DigiOptics Wholesale*.

*Order Details:*
• Purchase Order ID: ${purchaseOrderId}
• Order Date: ${orderDate}
• Total Sub-Orders: ${totalOrders}
• Total Items: ${totalItems}

Please check your email for the complete order details and Excel attachment.

Thank you,
*DigiOptics Wholesale Team*`;

export const vendorOrderUpdatedWhatsApp = ({ vendorName, purchaseOrderId, orderDate, updatedAt }) =>
  `Hello ${vendorName} 👋,

Your Purchase Order has been *Updated* on *DigiOptics Wholesale*.

*Order Details:*
• Purchase Order ID: ${purchaseOrderId}
• Original Order Date: ${orderDate}
• Updated On: ${updatedAt}

Please check your email for the updated order details and Excel attachment.

Thank you,
*DigiOptics Wholesale Team*`;

/**
 * Transaction Notification 1: Customer Payment Received (Matches Payment Receipt Email)
 */
export const customerPaymentReceivedWhatsApp = ({
  customerName,
  shopName,
  receiptNo,
  amount,
  paymentMode = "CASH",
  receiptDate,
  remainingDue = 0,
  availableAdvance = 0,
  companyName = "DigiOptics Wholesale",
  companyPhone = "+91 9650560526",
}) => {
  const party = shopName || customerName || "Valued Customer";
  const formattedDate = receiptDate
    ? new Date(receiptDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  return `Hello *${party}* 👋,

We are pleased to inform you that your payment has been successfully received and credited to your account.

*Payment Receipt Summary:*
• Receipt No: *${receiptNo}*
• Amount Received: *₹${fmtInr(amount)}*
• Payment Mode: *${paymentMode}*
• Date: ${formattedDate}

*Current Account Balance:*
• Outstanding Due (Udhaar): *₹${fmtInr(remainingDue)}*
• Advance Balance (Jama): *₹${fmtInr(availableAdvance)}*

Your official payment receipt PDF has been attached for your records. For any account queries, please contact ${companyPhone}.

Thank you,
*${companyName} Accounts Team*`;
};

/**
 * Transaction Notification 2: Vendor Payment Disbursed (Matches Vendor Payment Advice Email)
 */
export const vendorPaymentDisbursedWhatsApp = ({
  vendorName,
  firmName,
  receiptNo,
  amount,
  paymentMode = "BANK_TRANSFER",
  receiptDate,
  refInfo = "",
  remainingOutstanding = 0,
  companyName = "DigiOptics Wholesale",
  companyPhone = "+91 9650560526",
}) => {
  const party = firmName || vendorName || "Valued Supplier";
  const formattedDate = receiptDate
    ? new Date(receiptDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  const modeLabels = {
    CASH: "Cash Voucher",
    UPI: "UPI Transfer",
    CHEQUE: "Cheque (A/C Payee)",
    BANK_TRANSFER: "Bank Transfer (NEFT/RTGS/IMPS)",
    NEFT: "NEFT Transfer",
    RTGS: "RTGS Transfer",
  };
  const modeText = modeLabels[paymentMode] || paymentMode;

  return `Hello *${party}* 👋,

A payout of *₹${fmtInr(amount)}* has been successfully disbursed to your account by *${companyName}*.

*Payment Advice Summary:*
• Voucher / Ref No: *${receiptNo}*
• Amount Disbursed: *₹${fmtInr(amount)}*
• Payment Mode: *${modeText}*
• Date: ${formattedDate}
${refInfo ? `• Bank Ref / Cheque: *${refInfo}*\n` : ""}• Remaining Outstanding Payable: *₹${fmtInr(remainingOutstanding)}*

Your official payment voucher / disbursement advice PDF is attached for your accounting and GST reconciliation.

For any queries, please reach out to ${companyPhone}.

Thank you,
*${companyName} Accounts Team*`;
};

/**
 * Transaction Notification 3: Customer Advance Knocked-Off / Adjusted Against Credit Due
 */
export const customerAdvanceAdjustedWhatsApp = ({
  customerName,
  shopName,
  refNumber,
  adjustedAmount,
  remainingDue = 0,
  remainingAdvance = 0,
  companyName = "DigiOptics Wholesale",
  companyPhone = "+91 9650560526",
}) => {
  const party = shopName || customerName || "Valued Customer";

  return `Hello *${party}* 👋,

An advance adjustment has been processed against your outstanding credit due.

*Adjustment Summary:*
• Ref No: *${refNumber}*
• Amount Adjusted: *₹${fmtInr(adjustedAmount)}*
• Remaining Outstanding Due (Udhaar): *₹${fmtInr(remainingDue)}*
• Remaining Advance Balance (Jama): *₹${fmtInr(remainingAdvance)}*

Your ledger statement has been updated accordingly. For any queries, please contact ${companyPhone}.

Thank you,
*${companyName} Accounts Team*`;
};

/**
 * Transaction Notification 4: Order Placed on Credit (Amount Due to Us)
 */
export const customerOrderCreditDueWhatsApp = ({
  customerName,
  shopName,
  orderNumber,
  orderTotal,
  advancePaid = 0,
  addedToDue = 0,
  totalOutstandingDue = 0,
  creditLimit = 0,
  availableCredit = 0,
  companyName = "DigiOptics Wholesale",
  companyPhone = "+91 9650560526",
}) => {
  const party = shopName || customerName || "Valued Customer";

  return `Hello *${party}* 👋,

Your order *#${orderNumber}* has been confirmed on *${companyName}*.

*Order & Credit Summary:*
• Order Total: *₹${fmtInr(orderTotal)}*
${advancePaid > 0 ? `• Advance Paid: *₹${fmtInr(advancePaid)}*\n` : ""}• Added to Credit (Due): *₹${fmtInr(addedToDue)}*
• Total Outstanding Due: *₹${fmtInr(totalOutstandingDue)}*
${creditLimit > 0 ? `• Available Credit Limit: *₹${fmtInr(availableCredit)}* (of ₹${fmtInr(creditLimit)})\n` : ""}
Please ensure timely clearance of your credit balance. For statements or invoices, contact ${companyPhone}.

Thank you for your business!
*${companyName}*`;
};

/**
 * Transaction Notification 5: Payment Due Reminder (WhatsApp)
 */
export const paymentDueReminderWhatsApp = ({
  partyName,
  isVendor = false,
  totalDue = 0,
  overdueAmount = 0,
  creditDays = 30,
  asOfDate,
  companyName = "DigiOptics Wholesale",
  companyPhone = "+91 9650560526",
  bankDetails = null,
}) => {
  const formattedDate = asOfDate
    ? new Date(asOfDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  const bankText = bankDetails
    ? `\n*Bank Transfer Details:*\n• Bank: ${bankDetails.bankName || "HDFC Bank"}\n• A/C No: ${bankDetails.accountNumber || "—"}\n• IFSC: ${bankDetails.ifscCode || "—"}\n• UPI ID: ${bankDetails.upiId || "digioptics@hdfcbank"}\n`
    : "";

  return `Hello *${partyName}* 👋,

This is a gentle reminder regarding your outstanding balance with *${companyName}* as of ${formattedDate}.

*Account Statement Summary:*
• Total Outstanding Due: *₹${fmtInr(totalDue)}*
${Number(overdueAmount) > 0 ? `• Overdue Amount: *₹${fmtInr(overdueAmount)}* ⚠️\n` : ""}• Payment Terms: *${creditDays} Days*
${bankText}
Kindly arrange the payment at your earliest convenience. If you have already transferred the amount, please share the payment confirmation or UTR reference with our accounts desk.

For questions or statement reconciliation, feel free to contact us at ${companyPhone}.

Thank you for your cooperation,
*${companyName} Accounts Team*`;
};

