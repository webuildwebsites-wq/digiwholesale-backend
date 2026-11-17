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
    : "-";


export const generatePaymentReceiptHTML = (data) => {
  const {
    receiptNo,
    receiptDate,
    company = {},
    customer = {},
    paymentMode = "CASH",
    grossAmount = 0,
    paymentDetails = {},
    allocations = [],
    narration = "",
    isVendorPayout = false,
    partyType = "Customer",
    vendor = {},
    isOrderReceipt = false,
    orderSummary = null,
    orderPayments = [],
  } = data;

  const isVendor =
    isVendorPayout ||
    partyType === "Vendor" ||
    Boolean(vendor && (vendor.name || vendor.firm) && !customer?.shopName);

  // Logo resolution: use uploaded logo if present, else fallback to static DigiOptics logo
  const uploadedLogo =
    (data.companyLogo && String(data.companyLogo).trim()) ||
    (company?.logo && String(company.logo).trim()) ||
    "";
  const finalLogo = uploadedLogo || staticLogoDataUrl;

  const companyName =
    data.companyName || company?.name || "SAANCHI & CO.";
  const companyAddress =
    data.companyAddress ||
    company?.addressLine1 ||
    "3RD FLOOR, PEOPLES TV BUILDING, RAJA RAMMOHAN ROY ROAD,\nHAKIMPARA, SILIGURI";
  const companyPhone = data.companyPhone || company?.phone || "0353-4075631";
  const companyGstin =
    data.companyGstin || company?.gstin || "19AFWFS3883G1Z2";

  // Party Details
  const partyTitle = isVendor ? "Vendor Details" : "Customer / Party Details";
  const partyName = isVendor
    ? vendor?.name || vendor?.firm || "Vendor Partner"
    : customer?.shopName || customer?.customerName || customer?.ownerName || "Customer";
  const partyContact = isVendor
    ? vendor?.mobile || vendor?.phone || "-"
    : customer?.mobileNo1 || customer?.mobile || customer?.phone || "-";
  const partyGstin = isVendor
    ? vendor?.gstNumber || vendor?.gstin || "URP"
    : customer?.gstNumber || customer?.gstin || customer?.GSTNo || "URP";
  const partyAddress = isVendor
    ? vendor?.address || "-"
    : customer?.address || customer?.billToAddress?.address || "-";

  const modeLabels = {
    CASH: "Cash Voucher",
    UPI: "UPI Transfer",
    CHEQUE: "Cheque Payment",
    BANK_TRANSFER: "Bank Transfer / NEFT / RTGS",
    NEFT: "NEFT Transfer",
    RTGS: "RTGS Transfer",
    ONLINE: "Online Payment Gateway",
    ADVANCE_ADJUSTMENT: "Advance Balance Adjustment",
  };
  const modeName = modeLabels[paymentMode] || paymentMode;

  const refNumber =
    paymentDetails?.referenceNumber ||
    paymentDetails?.transactionId ||
    paymentDetails?.upiTransactionId ||
    paymentDetails?.chequeNumber ||
    receiptNo ||
    "-";

  const totalReceivedAmount = isOrderReceipt && orderSummary
    ? Number(orderSummary.paidAmount || grossAmount)
    : Number(grossAmount || 0);

  const amountInWords = numberToWordsINR(totalReceivedAmount);

  // Build Table Rows
  let tableHeaderHtml = "";
  let tableRowsHtml = "";

  const itemsList = Array.isArray(data.items) && data.items.length > 0
    ? data.items
    : Array.isArray(orderSummary?.items) && orderSummary.items.length > 0
      ? orderSummary.items
      : [];

  if (isVendor && itemsList.length > 0) {
    tableHeaderHtml = `
      <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
        <th style="width:28px; border-right:1px solid #000; padding:4px 2px; text-align:center;">#</th>
        <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Product / Item Name</th>
        <th style="width:95px; border-right:1px solid #000; padding:4px 4px; text-align:left;">Brand</th>
        <th style="width:85px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Category / Type</th>
        <th style="width:95px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Item Code / Ref</th>
        <th style="width:40px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Qty</th>
        <th style="width:85px; border-right:1px solid #000; padding:4px 6px; text-align:right;">Buying Price (₹)</th>
        <th style="width:90px; padding:4px 6px; text-align:right;">Total (₹)</th>
      </tr>
    `;

    tableRowsHtml = itemsList
      .map((item, idx) => {
        const itemName = item.itemName || item.productName || item.name || "Product";
        const brand = item.brand || item.brandName || "—";
        const category = item.category || item.categoryName || item.orderType || "STOCK";
        const code = item.code || item.productCode || item.hsnSac || refNumber || "—";
        const buyingPrice = Number(item.buyingPrice || item.price || 0);
        const qty = Number(item.qty || 0);
        const discount = Number(item.discountAmount || 0);
        const lineTotal = buyingPrice * qty - discount;
        return `
        <tr style="border-bottom:1px solid #000000;">
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${idx + 1}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; font-size:10px; font-weight:600; color:#0f172a;">${itemName}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; font-size:10px; color:#334155;">${brand}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:9.5px; font-weight:600; color:#475569;">${category}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:10px; font-family:monospace; color:#0284c7;">${code}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:10px; font-weight:700;">${qty}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-size:10px; font-family:monospace; font-weight:700; color:#475569;">₹${fmtNum(buyingPrice)}</td>
          <td style="padding:3px 6px; text-align:right; font-size:10px; font-weight:700; font-family:monospace; color:#0f172a;">₹${fmtNum(lineTotal)}</td>
        </tr>
      `;
      })
      .join("");
  } else if (isOrderReceipt && Array.isArray(orderPayments) && orderPayments.length > 0) {
    tableHeaderHtml = `
      <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
        <th style="width:28px; border-right:1px solid #000; padding:4px 2px; text-align:center;">#</th>
        <th style="width:85px; border-right:1px solid #000; padding:4px 4px; text-align:left;">Payment Date</th>
        <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Voucher / Ref #</th>
        <th style="width:110px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Payment Mode</th>
        <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Remarks / Payment Type</th>
        <th style="width:110px; border-right:1px solid #000; padding:4px 6px; text-align:right;">Amount (₹)</th>
        <th style="width:65px; padding:4px 4px; text-align:center;">Status</th>
      </tr>
    `;

    tableRowsHtml = orderPayments
      .map((p, idx) => `
        <tr style="border-bottom:1px solid #000000;">
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${idx + 1}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; font-size:10px; font-family:monospace;">${fmtDate(p.paymentDate)}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; font-size:10px; font-family:monospace; font-weight:700; color:#0284c7;">${p.referenceNumber || p.paymentNumber || "-"}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:9.5px;">${modeLabels[p.paymentMode] || p.paymentMode || "Advance / Bank"}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; font-size:10px; color:#1e293b;">${p.remarks || (idx === 0 && p.paymentNumber?.startsWith("ADV") ? "Booking Advance" : "Part Payment Installment")}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-size:10px; font-weight:700; font-family:monospace;">${fmtNum(p.amount)}</td>
          <td style="padding:3px 4px; text-align:center; font-size:9px; font-weight:700; color:#15803d;">CLEARED</td>
        </tr>
      `)
      .join("");
  } else if (Array.isArray(allocations) && allocations.length > 0) {
    tableHeaderHtml = `
      <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
        <th style="width:28px; border-right:1px solid #000; padding:4px 2px; text-align:center;">#</th>
        <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Invoice / Order Ref</th>
        <th style="width:90px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Doc Date</th>
        <th style="width:110px; border-right:1px solid #000; padding:4px 6px; text-align:right;">Invoice Total (₹)</th>
        <th style="width:110px; border-right:1px solid #000; padding:4px 6px; text-align:right;">Previously Paid (₹)</th>
        <th style="width:120px; border-right:1px solid #000; padding:4px 6px; text-align:right;">Amount Allocated (₹)</th>
        <th style="width:110px; padding:4px 6px; text-align:right;">Balance Remaining (₹)</th>
      </tr>
    `;

    tableRowsHtml = allocations
      .map((a, idx) => `
        <tr style="border-bottom:1px solid #000000;">
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${idx + 1}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; font-size:10px; font-family:monospace; font-weight:700; color:#0284c7;">${a.invoiceNumber || a.orderNumber || "-"}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:10px; font-family:monospace;">${fmtDate(a.invoiceDate || a.createdAt)}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-size:10px; font-family:monospace;">${fmtNum(a.invoiceAmount || a.grandTotal)}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-size:10px; font-family:monospace;">${fmtNum(a.previousPaid)}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-size:10px; font-weight:700; font-family:monospace; color:#15803d;">${fmtNum(a.allocatedAmount || a.amount)}</td>
          <td style="padding:3px 6px; text-align:right; font-size:10px; font-family:monospace; font-weight:600;">${fmtNum(a.remainingBalance)}</td>
        </tr>
      `)
      .join("");
  } else {
    tableHeaderHtml = `
      <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
        <th style="width:28px; border-right:1px solid #000; padding:4px 2px; text-align:center;">#</th>
        <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Transaction Description / Particulars</th>
        <th style="width:130px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Payment Mode</th>
        <th style="width:140px; border-right:1px solid #000; padding:4px 6px; text-align:left;">Reference # / UTR</th>
        <th style="width:120px; border-right:1px solid #000; padding:4px 6px; text-align:right;">${isVendor ? "Amount Paid (₹)" : "Amount Received (₹)"}</th>
        <th style="width:75px; padding:4px 4px; text-align:center;">Status</th>
      </tr>
    `;

    tableRowsHtml = `
      <tr style="border-bottom:1px solid #000000;">
        <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">1</td>
        <td style="border-right:1px solid #000; padding:3px 6px; font-size:10px; font-weight:600;">${isVendor ? "Vendor Payout Disbursement / Supplier Account Clearance" : "Direct Customer Khata Account Collection"}</td>
        <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:9.5px;">${modeName}</td>
        <td style="border-right:1px solid #000; padding:3px 6px; font-size:10px; font-family:monospace; font-weight:600; color:#0284c7;">${refNumber}</td>
        <td style="border-right:1px solid #000; padding:3px 6px; text-align:right; font-size:10px; font-weight:700; font-family:monospace;">${fmtNum(grossAmount)}</td>
        <td style="padding:3px 4px; text-align:center; font-size:9px; font-weight:700; color:#15803d;">CLEARED</td>
      </tr>
    `;
  }



  const orderDueBalance = orderSummary ? Number(orderSummary.balanceDue || 0) : 0;
  const orderTotalAmount = orderSummary ? Number(orderSummary.grandTotal || 0) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - ${receiptNo || "RCP"}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, "Segoe UI", Roboto, sans-serif;
      color: #000000;
      background: #ffffff;
      font-size: 10.5px;
      line-height: 1.25;
    }
    .invoice-wrapper {
      width: 100%;
      border: 1.5px solid #000000;
      background: #ffffff;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:8px 12px; border-bottom:1.5px solid #000000;">
      <div style="width:130px; min-height:50px; display:flex; align-items:center;">
        ${finalLogo ? `<img src="${finalLogo}" alt="Logo" style="max-height:55px; max-width:130px; object-fit:contain;" />` : ""}
      </div>
      <div style="flex:1; text-align:center; padding:0 10px;">
        <div style="font-size:13.5px; font-weight:700; margin-bottom:2px;">${isVendor ? "Vendor Payout Voucher" : "Payment Receipt / Voucher"}</div>
        <div style="font-size:19px; font-weight:800; color:#0284c7; letter-spacing:0.5px; margin-bottom:2px;">${companyName.toUpperCase()}</div>
        <div style="font-size:9.5px; font-weight:600; line-height:1.25; color:#1e293b; white-space:pre-line;">${companyAddress.toUpperCase()}</div>
        <div style="font-size:10px; font-weight:600; color:#1e293b; margin-top:1px;">Contact No. ${companyPhone}</div>
        <div style="font-size:10.5px; font-weight:700; margin-top:2px;">GST No : ${companyGstin}</div>
      </div>
      <div style="width:110px; text-align:right;">
        <div style="font-size:11px; font-weight:700;">Original Copy</div>
      </div>
    </div>

    <!-- Party Details & Receipt Meta 2 Columns -->
    <div style="display:flex; border-bottom:1.5px solid #000000;">
      <!-- Left Column: Party Details -->
      <div style="flex:1.2; padding:6px 10px; border-right:1px solid #000000; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:85px; font-weight:700; vertical-align:top;">${partyTitle} :</td>
            <td style="font-weight:800; font-size:11.5px; color:#000;">${partyName.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">Mobile :</td>
            <td style="font-family:monospace; font-weight:600;">${partyContact}</td>
          </tr>
          ${partyGstin && partyGstin !== "URP" ? `
          <tr>
            <td style="font-weight:700; vertical-align:top;">GST No :</td>
            <td style="font-weight:600; font-family:monospace;">${partyGstin}</td>
          </tr>` : ""}
          <tr>
            <td style="font-weight:700; vertical-align:top;">Address :</td>
            <td style="color:#1e293b;">${partyAddress}</td>
          </tr>
        </table>
      </div>

      <!-- Right Column: Receipt Meta Details -->
      <div style="flex:0.8; padding:6px 10px; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:95px; font-weight:700;">Receipt No :</td>
            <td style="font-weight:800; font-family:monospace; font-size:11.5px; color:#0284c7;">${receiptNo || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Receipt Date :</td>
            <td style="font-weight:700; font-family:monospace;">${fmtDate(receiptDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Payment Mode :</td>
            <td style="font-weight:600;">${modeName}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Ref # / UTR :</td>
            <td style="font-family:monospace; font-weight:600;">${refNumber}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- If Order Receipt, Order Summary Bar -->
    ${isOrderReceipt && orderSummary ? `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:6px 12px; border-bottom:1px solid #000000; font-size:10px;">
      <div>
        <span style="font-weight:700;">${isVendor ? "PO Reference:" : "Order Number:"}</span> <span style="font-family:monospace; font-weight:700; color:#0284c7;">${orderSummary.orderNumber || refNumber}</span>
        &nbsp;|&nbsp; <span style="font-weight:700;">Order Created:</span> <span style="font-family:monospace; font-weight:700; color:#0f172a;">${fmtDate(orderSummary.orderDate || orderSummary.createdAt)}</span>
        &nbsp;|&nbsp; <span style="font-weight:700;">Order Status:</span> <span style="font-weight:700; color:#059669;">${orderSummary.orderStatus || "Submitted"}</span>
      </div>
      <div>
        <span style="font-weight:700;">${isVendor ? "Purchase Total:" : "Order Total:"}</span> <span style="font-family:monospace; font-weight:700;">₹${fmtNum(orderTotalAmount)}</span>
        &nbsp;|&nbsp; <span style="font-weight:700;">Remaining Balance Due:</span> <span style="font-family:monospace; font-weight:800; color:${orderDueBalance > 0 ? '#b91c1c' : '#15803d'};">₹${fmtNum(orderDueBalance)}</span>
      </div>
    </div>` : ""}

    <!-- Items / Payments Table -->
    <table style="width:100%; border-collapse:collapse; border-bottom:1.5px solid #000000;">
      <thead>
        ${tableHeaderHtml}
      </thead>
      <tbody>
        ${tableRowsHtml}
        <!-- Integrated Total Row -->
        <tr style="font-weight:800; font-size:10.5px; border-top:1px solid #000;">
          <td colspan="${isVendor && itemsList.length > 0 ? 6 : 5}" style="border-right:1px solid #000; padding:4px 6px; text-align:right;">${isVendor ? "Total Amount Disbursed / Paid" : "Total Amount Received"}</td>
          <td style="border-right:1px solid #000; padding:4px 6px; text-align:right; font-family:monospace; color:#15803d;">₹${fmtNum(totalReceivedAmount)}</td>
          <td style="padding:4px 4px; text-align:center; font-size:9px; color:#15803d;">${isVendor ? "PAID OUT" : "PAID"}</td>
        </tr>
      </tbody>
    </table>

    <!-- Bottom Section: Words, Terms, QR Code, Signature -->
    <div style="display:flex; padding:8px 10px; font-size:9.5px;">
      <!-- Left Column -->
      <div style="flex:1.2; padding-right:15px; border-right:1px solid #000000;">
        <div style="margin-bottom:6px;">
          <span style="font-weight:700;">Total Amount ( In Words ) :</span><br>
          <span style="font-weight:800; font-size:10.5px;">${amountInWords}</span>
        </div>
        ${narration ? `
        <div style="margin-bottom:6px;">
          <span style="font-weight:700;">Payment Remarks / Narration :</span>
          <div style="font-size:9.5px; color:#1e293b; margin-top:1px;">${narration}</div>
        </div>` : ""}
        <div>
          <span style="font-weight:700; text-decoration:underline;">Declaration</span>
          <div style="font-size:8.5px; color:#1e293b; line-height:1.3; margin-top:2px;">
            ${isVendor
              ? "This is an authenticated computer-generated vendor payout voucher confirming disbursement of funds against supplier purchase orders / ledger account."
              : "This is an authenticated computer-generated payment voucher and official acknowledgment of money received and credited to the respective customer ledger account."}
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div style="flex:0.8; padding-left:15px; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
            <span style="font-weight:700;">Amount Cleared :</span>
            <span style="font-weight:800; font-family:monospace; color:#15803d;">₹${fmtNum(totalReceivedAmount)}</span>
          </div>
          ${isOrderReceipt && orderSummary ? `
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
            <span style="font-weight:700;">Remaining Due :</span>
            <span style="font-weight:800; font-family:monospace; color:${orderDueBalance > 0 ? '#b91c1c' : '#15803d'};">₹${fmtNum(orderDueBalance)}</span>
          </div>` : ""}
        </div>

        <div style="text-align:right; margin-top:20px;">
          <div style="font-size:11px; font-weight:800; color:#0284c7;">${companyName.toUpperCase()}</div>
          <div style="font-size:9.5px; font-weight:700; margin-top:28px;">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};


export const generatePaymentEmailHTML = (data) => {
  const {
    customerName,
    shopName,
    receiptNo,
    amount,
    receiptDate,
    paymentMode = "CASH",
    paymentDetails = {},
    remainingOutstanding = 0,
    availableAdvance = 0,
  } = data;

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

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1.5px solid #000000; padding: 20px;">
      <h2 style="color: #0284c7; margin-top: 0;">SAANCHI & CO. - Payment Receipt</h2>
      <p>Dear <strong>${shopName || customerName || "Customer"}</strong>,</p>
      <p>We gratefully acknowledge receipt of your payment of <strong>₹${fmtNum(amount)}</strong> on <strong>${formattedDate}</strong> via <strong>${modeText}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid #000;">
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 6px; font-weight: 700; border-right: 1px solid #000;">Receipt / Voucher #</td>
          <td style="padding: 6px; font-family: monospace;">${receiptNo}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 6px; font-weight: 700; border-right: 1px solid #000;">Amount Received</td>
          <td style="padding: 6px; font-weight: 700; color: #15803d;">₹${fmtNum(amount)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 6px; font-weight: 700; border-right: 1px solid #000;">Remaining Balance Due</td>
          <td style="padding: 6px; font-weight: 700; color: ${remainingOutstanding > 0 ? "#b91c1c" : "#15803d"};">₹${fmtNum(remainingOutstanding)}</td>
        </tr>
      </table>
      <p style="font-size: 11px; color: #475569;">Your official payment receipt PDF is attached for your accounting records.</p>
      <p style="margin-bottom: 0;">Warm regards,<br/><strong>SAANCHI & CO. Accounts Team</strong></p>
    </div>
  `;
};

export const generateVendorPaymentEmailHTML = (data) => {
  const {
    vendorName,
    firmName,
    receiptNo,
    amount,
    receiptDate,
    paymentMode = "BANK_TRANSFER",
    remainingOutstanding = 0,
  } = data;

  const formattedDate = receiptDate
    ? new Date(receiptDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : new Date().toLocaleDateString("en-IN");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1.5px solid #000000; padding: 20px;">
      <h2 style="color: #0284c7; margin-top: 0;">SAANCHI & CO. - Payment Disbursement Advice</h2>
      <p>Dear <strong>${firmName || vendorName || "Valued Supplier"}</strong>,</p>
      <p>A payment of <strong>₹${fmtNum(amount)}</strong> has been disbursed to your account on <strong>${formattedDate}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid #000;">
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 6px; font-weight: 700; border-right: 1px solid #000;">Voucher Ref #</td>
          <td style="padding: 6px; font-family: monospace;">${receiptNo}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 6px; font-weight: 700; border-right: 1px solid #000;">Disbursed Amount</td>
          <td style="padding: 6px; font-weight: 700; color: #15803d;">₹${fmtNum(amount)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000;">
          <td style="padding: 6px; font-weight: 700; border-right: 1px solid #000;">Remaining Balance Payable</td>
          <td style="padding: 6px; font-weight: 700;">₹${fmtNum(remainingOutstanding)}</td>
        </tr>
      </table>
      <p style="font-size: 11px; color: #475569;">Your official payment advice voucher PDF is attached.</p>
      <p style="margin-bottom: 0;">Warm regards,<br/><strong>SAANCHI & CO. Finance Desk</strong></p>
    </div>
  `;
};
