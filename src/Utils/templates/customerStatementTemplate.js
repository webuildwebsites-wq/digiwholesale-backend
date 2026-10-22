import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

let staticLogoDataUrl = "";
try {
  const logoBase64 = readFileSync(
    join(__dirname, "../../../public/DigiOptics.png"),
  ).toString("base64");
  staticLogoDataUrl = `data:image/png;base64,${logoBase64}`;
} catch {
  staticLogoDataUrl = "";
}

// Number to Words Converter for INR
export function numberToWordsINR(num) {
  const n = Math.round(Number(num || 0));
  if (!n || isNaN(n)) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ",
    "Seventeen ", "Eighteen ", "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(val) {
    let str = "";
    if (val > 99) {
      str += a[Math.floor(val / 100)] + "Hundred ";
      val %= 100;
    }
    if (val > 19) {
      str += b[Math.floor(val / 10)] + (val % 10 !== 0 ? " " + a[val % 10] : " ");
    } else if (val > 0) {
      str += a[val];
    }
    return str;
  }

  let crore = Math.floor(n / 10000000);
  let remainder = n % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder %= 1000;
  let hundreds = remainder;

  let words = "";
  if (crore > 0) words += inWords(crore) + "Crore ";
  if (lakh > 0) words += inWords(lakh) + "Lakh ";
  if (thousand > 0) words += inWords(thousand) + "Thousand ";
  if (hundreds > 0) words += inWords(hundreds);

  return (words.trim() ? words.trim() : "Zero") + " Rupees Only";
}

const fmtNum = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) =>
  d
    ? new Date(d)
      .toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "-")
    : "0";

/**
 * Optical Wholesale ERP Customer Ledger Statement HTML Template
 * Matches the classic black border-based ERP invoice layout with zero emojis.
 */
export function generateCustomerStatementHTML(data) {
  const {
    customerName = "Customer",
    ownerName = "",
    mobile = "",
    email = "",
    gstin = "",
    isGST = false,
    addr = "",
    ledgerCode = "CUST-LED",
    creditLimit = 0,
    creditDays = 30,
    creditUsed = 0,
    advanceAmount = 0,
    availableCredit = 0,
    totalDebit = 0,
    totalCredit = 0,
    wholesalerName = "SAANCHI & CO.",
    companyAddress = "New Delhi, India",
    companyPhone = "9650560526",
    companyEmail = "support@digioptics.com",
    companyGstin = "19AFWFS3883G1Z2",
    companyLogo = "",
    generatedOn = new Date().toLocaleDateString("en-IN").replace(/\//g, "-"),
    statementPeriod = "All Time (Complete Ledger)",
    bankDetails = {},
    transactions = [],
  } = data;

  const finalLogo = (companyLogo && String(companyLogo).trim()) || staticLogoDataUrl;
  const cleanCompanyGstin = (companyGstin && !String(companyGstin).startsWith("http") && !String(companyGstin).includes("/"))
    ? String(companyGstin).trim()
    : "Unregistered";

  const bank = {
    bankName: bankDetails.bankName || "HDFC BANK",
    accountNo: bankDetails.accountNo || bankDetails.accountNumber || "50200084729104",
    ifscCode: bankDetails.ifscCode || "HDFC0000247",
    branch: bankDetails.branch || "SILIGURI BRANCH",
    holderName: bankDetails.holderName || wholesalerName,
    upiId: bankDetails.upiId || `${companyPhone}@upi`,
  };

  const dueAmountClosing = Number(creditUsed || 0);

  const formatModeLabel = (mode) => {
    if (!mode) return "Direct Payment";
    const m = String(mode).toUpperCase();
    if (m === "ADVANCE_ADJUSTMENT") return "Advance Adjustment";
    if (m === "UPI") return "UPI / QR Code";
    if (m === "CASH") return "Cash Payment";
    if (m === "BANK_TRANSFER") return "Bank Transfer / NEFT";
    if (m === "CHEQUE") return "Cheque / DD";
    return String(mode).replace(/_/g, " ");
  };

  let effectivePeriod = statementPeriod;
  if (!effectivePeriod || effectivePeriod.includes("All Time") || effectivePeriod.includes("Complete Ledger")) {
    if (transactions && transactions.length > 0) {
      const validDates = transactions
        .map((t) => new Date(t.transactionDate || t.createdAt || t.orderDate).getTime())
        .filter((time) => !isNaN(time) && time > 0)
        .sort((a, b) => a - b);
      if (validDates.length > 0) {
        const fromStr = fmtDate(new Date(validDates[0]));
        const toStr = fmtDate(new Date(validDates[validDates.length - 1]));
        effectivePeriod = fromStr === toStr ? fromStr : `${fromStr} to ${toStr}`;
      }
    }
    if (!effectivePeriod || effectivePeriod.includes("All Time") || effectivePeriod.includes("Complete Ledger")) {
      effectivePeriod = `${generatedOn}`;
    }
  }

  // Build Transaction Rows
  const rowsHtml = (!transactions || transactions.length === 0)
    ? `<tr><td colspan="7" style="text-align:center; padding:15px; color:#64748B; font-size:10px;">No transactions recorded for this customer account.</td></tr>`
    : transactions
      .map((t, idx) => {
        const d = fmtDate(t.transactionDate || t.createdAt);
        const orderTotal = Number(t.orderGrandTotal != null ? t.orderGrandTotal : t.debit || 0);
        const paidAmount = Number(t.orderPaidAmount != null ? t.orderPaidAmount : t.credit || 0);
        const dueAmount = Number(
          t.orderBalanceDue != null ? t.orderBalanceDue : Math.max(0, orderTotal - paidAmount),
        );

        const debitStr = orderTotal > 0
          ? fmtNum(orderTotal)
          : Number(t.debit || 0) > 0
            ? fmtNum(t.debit)
            : "0.00";

        const creditStr = paidAmount > 0
          ? fmtNum(paidAmount)
          : Number(t.credit || 0) > 0
            ? fmtNum(t.credit)
            : "0.00";

        const balStr = dueAmount > 0
          ? `₹${fmtNum(dueAmount)} (Due)`
          : orderTotal > 0
            ? "₹0.00 (Paid)"
            : Number(t.runningBalance || 0) > 0
              ? `₹${fmtNum(t.runningBalance)} (Due)`
              : "₹0.00";

        const ref = t.orderNumber || t.referenceNumber || t.voucherId || "0";
        const isDirectPayment = Boolean(
          (t.referenceNumber && String(t.referenceNumber).startsWith("CPAY")) ||
          t.voucherType === "Receipt" ||
          t.voucherType === "Advance" ||
          (!t.voucherType?.toLowerCase().includes("invoice") && Number(t.credit) > 0 && !t.referenceNumber?.startsWith("BO-"))
        );

        const isOrder = !isDirectPayment && Boolean(
          (t.referenceNumber && (String(t.referenceNumber).startsWith("BO-") || String(t.referenceNumber).startsWith("ORD-"))) ||
          t.orderNumber ||
          t.voucherType === "Sales Invoice" ||
          t.voucherType === "Invoice" ||
          (t.orderGrandTotal != null && Number(t.orderGrandTotal) > 0)
        );

        let particulars = "";
        if (isDirectPayment) {
          const detectedMode = t.paymentMode || (t.narration?.toLowerCase().includes("upi") ? "UPI" : t.narration?.toLowerCase().includes("cash") ? "CASH" : "BANK_TRANSFER");
          particulars = `<span style="display:inline-block; font-weight:700; color:#059669; background:#dcfce7; padding:1px 4px; border-radius:2px; font-size:8px; margin-right:4px;">[${formatModeLabel(detectedMode)}]</span> Payment Received`;
          if (t.narration && !t.narration.toLowerCase().includes("sales invoice for order") && !t.narration.toLowerCase().includes("payment received via")) {
            particulars += ` &bull; ${t.narration}`;
          }
        } else if (isOrder) {
          const isDC = Boolean(t.billingMode === "DC" || t.voucherType === "Delivery Challan" || (t.hasChallan && !t.hasInvoice));
          particulars = isDC ? "Delivery Challan" : "Sales Invoice";
          const rawNarration = t.narration || t.description || "";
          const isAutoGenerated = /Sales Invoice for Order|Total:|Advance Paid:|Added to Credit|Wholesale Order/i.test(rawNarration);
          if (rawNarration && !isAutoGenerated) {
            particulars += ` &bull; ${rawNarration}`;
          }
        } else {
          particulars = t.voucherType || t.description || "General Ledger Entry";
        }

        const paymentsRow =
          t.orderPayments && Array.isArray(t.orderPayments) && t.orderPayments.length > 0
            ? `
              <tr style="background:#f8fafc; border-bottom:1.5px solid #000000;">
                <td colspan="7" style="padding:4px 6px 6px 6px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; padding-bottom:2px; border-bottom:1px dashed #cbd5e1; font-size:8.5px;">
                    <span style="font-weight:800; color:#0369a1; text-transform:uppercase; letter-spacing:0.3px;">
                      Payment Breakdown &amp; Installments (${t.orderPayments.length} Record${t.orderPayments.length > 1 ? "s" : ""})
                    </span>
                    <span style="color:#475569; font-weight:600;">
                      Order Total: <strong>₹${debitStr}</strong> &bull; Total Paid: <strong style="color:#15803d;">₹${creditStr}</strong> &bull; Balance Due: <strong style="color:${dueAmount > 0 ? "#b91c1c" : "#15803d"};">₹${fmtNum(dueAmount)}</strong>
                    </span>
                  </div>
                  <table style="width:100%; border-collapse:collapse; background:#ffffff; border:1px solid #94a3b8; font-size:8px;">
                    <thead>
                      <tr style="background:#e2e8f0; border-bottom:1px solid #94a3b8; font-weight:700; color:#334155;">
                        <th style="width:44px; border-right:1px solid #cbd5e1; padding:2.5px 3px; text-align:center;">Inst. #</th>
                        <th style="width:74px; border-right:1px solid #cbd5e1; padding:2.5px 4px; text-align:center;">Payment Date</th>
                        <th style="width:115px; border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:left;">Payment Method</th>
                        <th style="width:145px; border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:left;">Ref / Voucher / UTR</th>
                        <th style="border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:left;">Narration / Payment Details</th>
                        <th style="width:85px; border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:right;">Amount (₹)</th>
                        <th style="width:62px; padding:2.5px 3px; text-align:center;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${t.orderPayments
              .map((p, pIdx) => {
                const pDate = fmtDate(p.paymentDate || p.createdAt || t.transactionDate);
                const pMode = formatModeLabel(p.paymentMode);
                const pRef = p.referenceNumber || p.paymentNumber || p.paymentId || "-";
                let pRemarks = p.remarks || (p.paymentMode === "ADVANCE_ADJUSTMENT" ? "Adjusted from Customer Advance Balance" : "Part-Payment Received");
                if (p.utrNumber && p.utrNumber !== pRef) {
                  pRemarks += ` (UTR: ${p.utrNumber})`;
                }
                if (p.bankName) {
                  pRemarks += ` [${p.bankName}]`;
                }
                const pStatus = p.status || "CLEARED";
                const isCleared = pStatus === "CLEARED" || pStatus === "PAID" || pStatus === "COMPLETED";
                return `
                            <tr style="border-bottom:1px solid #e2e8f0;">
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 3px; text-align:center; font-weight:700; color:#475569;">#${pIdx + 1}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 4px; text-align:center; font-family:monospace; color:#1e293b;">${pDate}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; font-weight:600; color:#0f172a;">${pMode}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; font-family:monospace; font-weight:700; color:#0284c7;">${pRef}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; color:#475569;">${pRemarks}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:right; font-family:monospace; font-weight:700; color:#15803d;">₹${fmtNum(p.amount)}</td>
                              <td style="padding:2.5px 3px; text-align:center;">
                                <span style="font-weight:700; font-size:7.5px; padding:1px 3px; border-radius:2px; ${isCleared ? 'background:#dcfce7; color:#15803d; border:0.5px solid #86efac;' : 'background:#fef3c7; color:#b45309; border:0.5px solid #fde68a;'}">${pStatus}</span>
                              </td>
                            </tr>
                          `;
              })
              .join("")}
                    </tbody>
                  </table>
                </td>
              </tr>
            `
            : "";

        return `
            <tr style="border-bottom: 1px solid #000000;">
              <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${idx + 1}</td>
              <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-family:monospace; font-size:9.5px;">${d}</td>
              <td style="border-right:1px solid #000; padding:3px 6px; font-family:monospace; font-weight:700; font-size:10px; color:#0284c7;">${ref}</td>
              <td style="border-right:1px solid #000; padding:3px 6px; font-size:9.5px; color:#1e293b;">${particulars}</td>
              <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-size:10px; font-weight:600; color:#0f172a;">${debitStr}</td>
              <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-size:10px; font-weight:700; color:#15803d;">${creditStr}</td>
              <td style="padding:3px 6px; text-align:right; font-family:monospace; font-size:10px; font-weight:700; color:${dueAmount > 0 ? "#b91c1c" : "#15803d"};">${balStr}</td>
            </tr>
            ${paymentsRow}
          `;
      })
      .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Customer Ledger Statement - ${customerName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: #000000;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <div style="width: 100%; max-width: 800px; margin: 0 auto; border: 1.5px solid #000000; background: #ffffff;">

    <!-- 1. Header: Logo, Wholesaler Information, Statement Meta -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000000;">
      <tr>
        <td style="width: 125px; padding: 6px; vertical-align: middle; text-align: center; border-right: 1px solid #000000;">
          ${finalLogo ? `<img src="${finalLogo}" alt="Logo" style="max-width: 110px; max-height: 52px; object-fit: contain;" />` : `<div style="font-weight: 900; font-size: 13px;">${wholesalerName}</div>`}
        </td>
        <td style="padding: 6px 12px; vertical-align: middle;">
          <div style="font-weight: 900; font-size: 15px; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">${wholesalerName}</div>
          <div style="font-size: 9.5px; color: #1e293b; margin-top: 2px; line-height: 1.35;">${companyAddress}</div>
          <div style="font-size: 9.5px; color: #1e293b; margin-top: 2px;">Phone: <strong>${companyPhone}</strong> | Email: <strong>${companyEmail}</strong></div>
        </td>
        <td style="width: 210px; padding: 6px 10px; vertical-align: middle; border-left: 1px solid #000000; font-size: 9px; line-height: 1.4;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-weight: 700; width: 85px;">Statement Date:</td>
              <td style="font-weight: 600; font-family: monospace;">${generatedOn}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Period :</td>
              <td style="font-weight: 700; color: #0f172a; font-size: 8.5px;">${effectivePeriod}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Ledger Code :</td>
              <td style="font-weight: 800; font-family: monospace; color: #0284c7;">${ledgerCode}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Credit Terms :</td>
              <td style="font-weight: 600;">${creditDays} Days Credit</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 2. Document Title Banner -->
    <div style="text-align: center; font-weight: 800; font-size: 11px; padding: 4px 0; letter-spacing: 1px; background: #f8fafc; border-bottom: 1.5px solid #000000; text-transform: uppercase; color: #0f172a;">
      CUSTOMER STATEMENT 
    </div>

    <!-- 3. Customer & Credit Information -->
    <div style="display: flex; border-bottom: 1.5px solid #000000;">
      <!-- Customer / Buyer Details -->
      <div style="flex: 1.25; padding: 6px 10px; border-right: 1px solid #000000; font-size: 9.5px; line-height: 1.4;">
        <div style="font-weight: 800; font-size: 9.5px; text-transform: uppercase; color: #0284c7; margin-bottom: 2px;">CUSTOMER / BUYER DETAILS</div>
        <div style="font-weight: 800; font-size: 11.5px; color: #000000;">${customerName}</div>
        <div style="color: #334155; margin-top: 1px;">
          Owner: <strong>${ownerName || "N/A"}</strong> | Mob: <strong>${mobile || "N/A"}</strong> | Email: <strong>${email || "N/A"}</strong>
        </div>
        <div style="color: #334155;">Address: ${addr || "N/A"}</div>
        <div style="margin-top: 2px;">GSTIN: <strong style="font-family: monospace; font-size: 10px;">${isGST ? gstin : "Unregistered / Non-GST"}</strong></div>
      </div>

      <!-- Credit & Account Terms -->
      <div style="flex: 1; padding: 6px 10px; font-size: 9.5px; line-height: 1.4;">
        <div style="font-weight: 800; font-size: 9.5px; text-transform: uppercase; color: #059669; margin-bottom: 2px;">CREDIT &amp; ACCOUNT TERMS</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <tr>
            <td style="font-weight: 750; width: 95px;">Ledger Code:</td>
            <td style="font-family: monospace; font-weight: 700;">${ledgerCode}</td>
          </tr>
          <tr>
            <td style="font-weight: 750;">Credit Limit:</td>
            <td style="font-weight: 600;">₹${fmtNum(creditLimit)} (${creditDays} days)</td>
          </tr>
          <tr>
            <td style="font-weight: 750;">Available Credit:</td>
            <td style="font-weight: 600;">₹${fmtNum(availableCredit)}</td>
          </tr>
          <tr>
            <td style="font-weight: 750;">Account Status:</td>
            <td style="font-weight: 700; color: ${dueAmountClosing > 0 ? "#b91c1c" : "#15803d"};">
              ${dueAmountClosing > 0 ? `₹${fmtNum(dueAmountClosing)} (Due)` : `₹${fmtNum(advanceAmount)} (Advance)`}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 4. Financial Status Strip (4 boxes with black borders) -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000000; font-size: 9.5px; background: #f8fafc;">
      <tr>
        <td style="width: 25%; padding: 5px 8px; border-right: 1px solid #000000; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Total Invoiced</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: #0f172a; margin-top: 2px;">₹${fmtNum(totalDebit)}</div>
        </td>
        <td style="width: 25%; padding: 5px 8px; border-right: 1px solid #000000; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Total Collected</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: #15803d; margin-top: 2px;">₹${fmtNum(totalCredit)}</div>
        </td>
        <td style="width: 25%; padding: 5px 8px; border-right: 1px solid #000000; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Advance Available</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: #0284c7; margin-top: 2px;">₹${fmtNum(advanceAmount)}</div>
        </td>
        <td style="width: 25%; padding: 5px 8px; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Net Outstanding Due</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: ${dueAmountClosing > 0 ? "#b91c1c" : "#15803d"}; margin-top: 2px;">₹${fmtNum(dueAmountClosing)}</div>
        </td>
      </tr>
    </table>

    <!-- 5. Transactions Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
      <thead>
        <tr style="background: #ffffff; border-bottom: 1px solid #000000; font-weight: 700;">
          <th style="width: 28px; border-right: 1px solid #000; padding: 4px 2px; text-align: center;">#</th>
          <th style="width: 75px; border-right: 1px solid #000; padding: 4px 4px; text-align: center;">Date</th>
          <th style="width: 130px; border-right: 1px solid #000; padding: 4px 6px; text-align: left;">Ref / Doc No.</th>
          <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: left;">Particulars &amp; Narration</th>
          <th style="width: 95px; border-right: 1px solid #000; padding: 4px 6px; text-align: right;">Debit (₹)</th>
          <th style="width: 95px; border-right: 1px solid #000; padding: 4px 6px; text-align: right;">Credit (₹)</th>
          <th style="width: 110px; padding: 4px 6px; text-align: right;">Balance (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- 6. Bottom Summary: Declaration & Authorised Signatory -->
    <table style="width: 100%; border-collapse: collapse; border-top: 1.5px solid #000000;">
      <tr>
        <!-- Left: Declaration & Terms -->
        <td style="width: 58%; padding: 8px 12px; vertical-align: top; border-right: 1px solid #000000; font-size: 9px; line-height: 1.45;">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 9px; color: #0f172a; margin-bottom: 3px;">Declaration &amp; Notes:</div>
          <div style="color: #475569; font-size: 8.5px; line-height: 1.45;">
            &bull; This is an authentic computer-generated Customer Khata Statement.<br/>
            &bull; All transactions, invoices, and payment receipts are recorded subject to realization.<br/>
            &bull; For any discrepancies or reconciliation requests, please contact our accounts department within 7 days.
          </div>
        </td>

        <!-- Right: Closing Summary & Authorised Signatory -->
        <td style="width: 38%; padding: 6px 10px; vertical-align: top; font-size: 10px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr style="border-bottom: 1px solid #000000;">
              <td style="padding: 3px 0; font-weight: 700;">Total Invoiced:</td>
              <td style="padding: 3px 0; text-align: right; font-weight: 700; font-family: monospace;">₹${fmtNum(totalDebit)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #000000;">
              <td style="padding: 3px 0; font-weight: 700;">Total Received:</td>
              <td style="padding: 3px 0; text-align: right; font-weight: 700; font-family: monospace; color: #15803d;">₹${fmtNum(totalCredit)}</td>
            </tr>
            <tr style="border-bottom: 1.5px solid #000000; background: #f8fafc;">
              <td style="padding: 4px 0; font-weight: 800; font-size: 10px;">Net Outstanding Due:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 800; font-size: 11px; font-family: monospace; color: ${dueAmountClosing > 0 ? "#b91c1c" : "#15803d"};">
                ₹${fmtNum(dueAmountClosing)}
              </td>
            </tr>
          </table>

          <div style="text-align: right; margin-top: 14px;">
            <div style="font-size: 9.5px; font-weight: 700;">For ${wholesalerName}</div>
            <div style="height: 38px;"></div>
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; border-top: 1px dashed #000000; display: inline-block; padding-top: 2px;">
              Authorised Signatory
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- 7. Footer Notice -->
    <div style="font-size: 8px; color: #64748b; padding: 4px 8px; border-top: 1px solid #000000; display: flex; justify-content: space-between;">
      <div>System-generated account statement. Subject to realization of cheques/drafts.</div>
      <div>Generated on: ${generatedOn} | ${wholesalerName}</div>
    </div>
  </div>
</body>
</html>`;
}
