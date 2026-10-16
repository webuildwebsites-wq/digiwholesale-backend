import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import QRCode from "qrcode";

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

// Synchronous QR Code SVG Generator for offline and fast PDF compilation
export function generateQRCodeSVG(text, sizePx = 75) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const modSize = qr.modules.size;
    const data = qr.modules.data;
    let d = "";
    for (let r = 0; r < modSize; r++) {
      for (let c = 0; c < modSize; c++) {
        if (data[r * modSize + c]) {
          d += `M${c + 2} ${r + 2}h1v1h-1z `;
        }
      }
    }
    const total = modSize + 4;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}"><rect width="100%" height="100%" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>`;
  } catch {
    return "";
  }
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
    bankDetails = {},
    transactions = [],
  } = data;

  const finalLogo = (companyLogo && String(companyLogo).trim()) || staticLogoDataUrl;

  const bank = {
    bankName: bankDetails.bankName || "HDFC BANK",
    accountNo: bankDetails.accountNo || bankDetails.accountNumber || "50200084729104",
    ifscCode: bankDetails.ifscCode || "HDFC0000247",
    branch: bankDetails.branch || "SILIGURI BRANCH",
    holderName: bankDetails.holderName || wholesalerName,
    upiId: bankDetails.upiId || `${companyPhone}@upi`,
  };

  const dueAmountClosing = Number(creditUsed || 0);
  const upiQrString = `upi://pay?pa=${bank.upiId}&pn=${encodeURIComponent(wholesalerName)}&am=${dueAmountClosing > 0 ? dueAmountClosing.toFixed(2) : "0"}&cu=INR`;
  const qrSvg = generateQRCodeSVG(upiQrString, 72);

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
          const particulars =
            t.narration ||
            t.description ||
            t.voucherType ||
            (t.orderNumber ? `Wholesale Order #${t.orderNumber}` : "Sales Invoice");

          const paymentsRow =
            t.orderPayments && Array.isArray(t.orderPayments) && t.orderPayments.length > 0
              ? `
              <tr style="background:#f8fafc; border-bottom:1px solid #000000;">
                <td colspan="7" style="padding:3px 8px; font-size:9px; color:#475569; line-height:1.35;">
                  <span style="font-weight:700; color:#0284c7; text-transform:uppercase;">Payment Installments:</span>
                  ${t.orderPayments
                    .map(
                      (p) =>
                        `<span style="display:inline-block; margin-left:6px; font-family:monospace;">${p.referenceNumber || p.paymentNumber || "Payment"}: <strong>₹${fmtNum(p.amount)}</strong> (${p.paymentMode || "Paid"})</span>`,
                    )
                    .join(" &bull; ")}
                </td>
              </tr>
            `
              : "";

          return `
            <tr style="border-bottom:1px solid #000000;">
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
        <td style="width: 185px; padding: 6px 10px; vertical-align: middle; border-left: 1px solid #000000; font-size: 9.5px; line-height: 1.4;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-weight: 700; width: 70px;">GST No :</td>
              <td style="font-weight: 800; font-family: monospace; font-size: 10.5px;">${companyGstin}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Date :</td>
              <td style="font-weight: 600; font-family: monospace;">${generatedOn}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Ledger :</td>
              <td style="font-weight: 800; font-family: monospace; color: #0284c7;">${ledgerCode}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 2. Document Title Banner -->
    <div style="text-align: center; font-weight: 800; font-size: 11px; padding: 4px 0; letter-spacing: 1px; background: #f8fafc; border-bottom: 1.5px solid #000000; text-transform: uppercase; color: #0f172a;">
      CUSTOMER STATEMENT / KHATA LEDGER
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

    <!-- 6. Bottom Summary: Bank Details, UPI QR, In Words & Authorised Signatory -->
    <table style="width: 100%; border-collapse: collapse; border-top: 1.5px solid #000000;">
      <tr>
        <!-- Left: Bank Details & UPI QR -->
        <td style="width: 62%; padding: 6px 10px; vertical-align: top; border-right: 1px solid #000000; font-size: 9.5px; line-height: 1.35;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Net Outstanding in Words:</div>
          <div style="font-weight: 800; color: #0284c7; font-size: 10px; text-transform: uppercase; margin-bottom: 6px;">
            ${numberToWordsINR(dueAmountClosing)}
          </div>
          <div style="display: flex; gap: 10px; align-items: center; margin-top: 4px;">
            <div style="border: 1px solid #000000; padding: 2px; background: #ffffff; text-align: center;">
              ${qrSvg}
              <div style="font-size: 7px; font-weight: 700; color: #000;">SCAN TO PAY</div>
            </div>
            <div>
              <div style="font-weight: 800; text-transform: uppercase; font-size: 9.5px; color: #0f172a;">BANK DETAILS FOR PAYMENT</div>
              <table style="border-collapse: collapse; font-size: 9px; margin-top: 2px;">
                <tr><td style="font-weight: 700; width: 75px;">Bank Name:</td><td>${bank.bankName}</td></tr>
                <tr><td style="font-weight: 700;">Account No:</td><td style="font-family: monospace; font-weight: 700;">${bank.accountNo}</td></tr>
                <tr><td style="font-weight: 700;">IFSC Code:</td><td style="font-family: monospace; font-weight: 700;">${bank.ifscCode}</td></tr>
                <tr><td style="font-weight: 700;">Branch:</td><td>${bank.branch}</td></tr>
                <tr><td style="font-weight: 700;">UPI ID:</td><td style="font-family: monospace;">${bank.upiId}</td></tr>
              </table>
            </div>
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
