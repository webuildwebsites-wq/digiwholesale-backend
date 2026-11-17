import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

let staticLogoDataUrl = "";
try {
  const logoBase64 = readFileSync(
    join(__dirname, "../../../../public/DigiOptics.png"),
  ).toString("base64");
  staticLogoDataUrl = `data:image/png;base64,${logoBase64}`;
} catch {
  staticLogoDataUrl = "";
}

function numberToWordsINR(num) {
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

export const generateVendorOrderInvoiceHTML = (data) => {
  const {
    invoiceNo,
    orderDate,
    receivedDate,
    vendorName = "Vendor Partner",
    vendorAddress = "-",
    vendorPhone = "-",
    vendorGstin = "URP",
    companyName = "DigiOptics Wholesale",
    companyAddress = "WeWork Eldeco Centre, Block A, Shivalik Colony, Malviya Nagar, New Delhi 110017",
    companyPhone = "+91 9650560526",
    companyEmail = "support@digioptics.com",
    companyGstin = "GST9876543210",
    companyLogo = "",
    logoUrl = "",
    items = [],
    subTotal = 0,
    gstTotal = 0,
    total = 0,
  } = data;

  const finalLogo =
    (companyLogo && String(companyLogo).trim()) ||
    (logoUrl && String(logoUrl).trim()) ||
    staticLogoDataUrl;
  const amountInWords = numberToWordsINR(total);

  let totalQty = 0;
  const itemsRows = items
    .map((item, i) => {
      const qty = Number(item.quantity || item.qty || 1);
      totalQty += qty;
      const rate = Number(item.buyingPrice || item.price || 0);
      const amt = Number(item.totalAmount || rate * qty);
      const tax = Number(item.taxAmount || 0);

      return `
        <tr style="border-bottom:1px solid #000000;">
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${i + 1}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:left;">
            <div style="font-weight:700; font-size:10px; color:#000; text-transform:uppercase;">${item.itemName || item.name || "Optical Item"}</div>
            ${item.productCode ? `<div style="font-size:9px; color:#334155; font-family:monospace;">Code: ${item.productCode}</div>` : ""}
          </td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:9.5px;">${item.category || "-"}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-family:monospace; font-size:9.5px;">${item.hsnSac || "90015000"}</td>
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px; font-weight:600;">${qty}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:right; font-family:monospace; font-size:10px;">${fmtNum(rate)}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:right; font-family:monospace; font-size:10px;">${fmtNum(tax)}</td>
          <td style="padding:3px 6px; text-align:right; font-weight:700; font-family:monospace; font-size:10px;">${fmtNum(amt)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vendor Purchase Invoice - ${invoiceNo || "DigiOptics"}</title>
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
        <div style="font-size:13.5px; font-weight:700; margin-bottom:2px;">Purchase Tax Invoice</div>
        <div style="font-size:19px; font-weight:800; color:#0284c7; letter-spacing:0.5px; margin-bottom:2px;">${companyName.toUpperCase()}</div>
        <div style="font-size:9.5px; font-weight:600; line-height:1.25; color:#1e293b; white-space:pre-line;">${companyAddress.toUpperCase()}</div>
        <div style="font-size:10px; font-weight:600; color:#1e293b; margin-top:1px;">Contact No. ${companyPhone} | ${companyEmail}</div>
        <div style="font-size:10.5px; font-weight:700; margin-top:2px;">GST No : ${companyGstin}</div>
      </div>
      <div style="width:110px; text-align:right;">
        <div style="font-size:11px; font-weight:700;">Original Copy</div>
      </div>
    </div>

    <!-- Vendor & Purchase Info 2 Columns -->
    <div style="display:flex; border-bottom:1.5px solid #000000;">
      <!-- Left Column: Vendor Details -->
      <div style="flex:1.2; padding:6px 10px; border-right:1px solid #000000; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:90px; font-weight:700; vertical-align:top;">Vendor Name :</td>
            <td style="font-weight:800; font-size:11.5px; color:#000;">${vendorName.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">Mobile / Tel :</td>
            <td style="font-family:monospace; font-weight:600;">${vendorPhone}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">GST No :</td>
            <td style="font-weight:600; font-family:monospace;">${vendorGstin}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">Address :</td>
            <td style="color:#1e293b;">${vendorAddress}</td>
          </tr>
        </table>
      </div>

      <!-- Right Column: Invoice Details -->
      <div style="flex:0.8; padding:6px 10px; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:95px; font-weight:700;">Invoice No :</td>
            <td style="font-weight:800; font-family:monospace; font-size:11.5px;">${invoiceNo || "PUR-001"}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Order Date :</td>
            <td style="font-weight:700; font-family:monospace;">${fmtDate(orderDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Received Date :</td>
            <td style="font-family:monospace;">${fmtDate(receivedDate || orderDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Status :</td>
            <td style="font-weight:700; color:#15803d;">COMPLETED & RECEIVED</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width:100%; border-collapse:collapse; border-bottom:1.5px solid #000000;">
      <thead>
        <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
          <th style="width:26px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Sn.</th>
          <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Material / Product Description</th>
          <th style="width:80px; border-right:1px solid #000; padding:4px 4px; text-align:center;">Category</th>
          <th style="width:65px; border-right:1px solid #000; padding:4px 4px; text-align:center;">HSN/SAC</th>
          <th style="width:34px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Qty</th>
          <th style="width:75px; border-right:1px solid #000; padding:4px 4px; text-align:right;">Rate (₹)</th>
          <th style="width:75px; border-right:1px solid #000; padding:4px 4px; text-align:right;">Tax (₹)</th>
          <th style="width:85px; padding:4px 6px; text-align:right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        <!-- Integrated Totals -->
        <tr style="border-top:1px solid #000;">
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="3" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">Subtotal (Taxable)</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(subTotal)}</td>
        </tr>
        <tr style="border-bottom:1px solid #000;">
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="3" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">GST Total</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(gstTotal)}</td>
        </tr>
        <tr style="font-weight:800; font-size:10.5px; border-bottom:1.5px solid #000000;">
          <td colspan="4" style="border-right:1px solid #000; padding:4px 6px; text-align:center;">Total</td>
          <td style="border-right:1px solid #000; padding:4px 2px; text-align:center;">${totalQty}</td>
          <td colspan="2" style="border-right:1px solid #000;"></td>
          <td style="padding:4px 6px; text-align:right; font-family:monospace;">${fmtNum(total)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Bottom Section: Words, Terms, Signatures -->
    <div style="display:flex; padding:6px 10px; font-size:9.5px;">
      <!-- Left Column -->
      <div style="flex:1.2; padding-right:15px; border-right:1px solid #000000;">
        <div style="margin-bottom:6px;">
          <span style="font-weight:700;">Total Purchase Value ( In Words ) :</span><br>
          <span style="font-weight:800; font-size:10px;">${amountInWords}</span>
        </div>
        <div>
          <span style="font-weight:700; text-decoration:underline;">Declaration</span>
          <div style="font-size:8.5px; color:#1e293b; line-height:1.3; margin-top:2px;">
            This is an authenticated computer-generated purchase order and tax document reflecting optical supplies procured and verified under GST regulations.
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div style="flex:0.8; padding-left:15px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:10px;">
          <span style="font-weight:700;">Grand Total :</span>
          <span style="font-weight:800; font-family:monospace; color:#0284c7;">₹${fmtNum(total)}</span>
        </div>

        <div style="text-align:right; margin-top:20px;">
          <div style="font-size:11px; font-weight:800; color:#0284c7;">${companyName.toUpperCase()}</div>
          <div style="font-size:9.5px; font-weight:700; margin-top:25px;">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const generateVendorReturnInvoiceHTML = (data) => {
  const {
    invoiceNo,
    returnDate,
    orderDate,
    vendorName = "Vendor Partner",
    vendorAddress = "-",
    vendorPhone = "-",
    vendorGstin = "URP",
    companyName = "DigiOptics Wholesale",
    companyAddress = "WeWork Eldeco Centre, Block A, Shivalik Colony, Malviya Nagar, New Delhi 110017",
    companyPhone = "+91 9650560526",
    companyEmail = "support@digioptics.com",
    companyGstin = "GST9876543210",
    companyLogo = "",
    logoUrl = "",
    items = [],
    subTotal = 0,
    gstTotal = 0,
    total = 0,
  } = data;

  const finalLogo =
    (companyLogo && String(companyLogo).trim()) ||
    (logoUrl && String(logoUrl).trim()) ||
    staticLogoDataUrl;
  const amountInWords = numberToWordsINR(total);

  let totalReturnQty = 0;
  const itemsRows = items
    .map((item, i) => {
      const returnQty = (item.damageQty || 0) + (item.missingQty || 0);
      totalReturnQty += returnQty;
      const rate = Number(item.buyingPrice || item.price || 0);
      const amt = Number(item.totalAmount || rate * returnQty);

      return `
        <tr style="border-bottom:1px solid #000000;">
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${i + 1}</td>
          <td style="border-right:1px solid #000; padding:3px 6px; text-align:left;">
            <div style="font-weight:700; font-size:10px; color:#000; text-transform:uppercase;">${item.name || item.itemName || "Optical Item"}</div>
            ${item.productCode ? `<div style="font-size:9px; color:#334155; font-family:monospace;">Code: ${item.productCode}</div>` : ""}
          </td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:center; font-size:9.5px;">${item.category || "-"}</td>
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px;">${item.originalQty || 0}</td>
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px; color:#b91c1c; font-weight:700;">${item.damageQty || 0}</td>
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px; color:#d97706; font-weight:700;">${item.missingQty || 0}</td>
          <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; font-size:10px; font-weight:700;">${returnQty}</td>
          <td style="border-right:1px solid #000; padding:3px 4px; text-align:right; font-family:monospace; font-size:10px;">${fmtNum(rate)}</td>
          <td style="padding:3px 6px; text-align:right; font-weight:700; font-family:monospace; font-size:10px;">${fmtNum(amt)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vendor Return Credit Note / Debit Note - ${invoiceNo || "RET"}</title>
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
        <div style="font-size:13.5px; font-weight:700; margin-bottom:2px;">Vendor Purchase Return Note</div>
        <div style="font-size:19px; font-weight:800; color:#0284c7; letter-spacing:0.5px; margin-bottom:2px;">${companyName.toUpperCase()}</div>
        <div style="font-size:9.5px; font-weight:600; line-height:1.25; color:#1e293b; white-space:pre-line;">${companyAddress.toUpperCase()}</div>
        <div style="font-size:10px; font-weight:600; color:#1e293b; margin-top:1px;">Contact No. ${companyPhone} | ${companyEmail}</div>
        <div style="font-size:10.5px; font-weight:700; margin-top:2px;">GST No : ${companyGstin}</div>
      </div>
      <div style="width:110px; text-align:right;">
        <div style="font-size:11px; font-weight:700;">Original Copy</div>
      </div>
    </div>

    <!-- Vendor & Return Info 2 Columns -->
    <div style="display:flex; border-bottom:1.5px solid #000000;">
      <!-- Left Column: Vendor Details -->
      <div style="flex:1.2; padding:6px 10px; border-right:1px solid #000000; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:90px; font-weight:700; vertical-align:top;">Vendor Name :</td>
            <td style="font-weight:800; font-size:11.5px; color:#000;">${vendorName.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">Mobile / Tel :</td>
            <td style="font-family:monospace; font-weight:600;">${vendorPhone}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">GST No :</td>
            <td style="font-weight:600; font-family:monospace;">${vendorGstin}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">Address :</td>
            <td style="color:#1e293b;">${vendorAddress}</td>
          </tr>
        </table>
      </div>

      <!-- Right Column: Return Info -->
      <div style="flex:0.8; padding:6px 10px; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:105px; font-weight:700;">Return Note # :</td>
            <td style="font-weight:800; font-family:monospace; font-size:11.5px;">${invoiceNo || "RET-001"}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Return Date :</td>
            <td style="font-weight:700; font-family:monospace;">${fmtDate(returnDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Order Date :</td>
            <td style="font-family:monospace;">${fmtDate(orderDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Discrepancy Type:</td>
            <td style="font-weight:700; color:#b91c1c;">QC DAMAGE / SHORTAGE</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width:100%; border-collapse:collapse; border-bottom:1.5px solid #000000;">
      <thead>
        <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
          <th style="width:26px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Sn.</th>
          <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Material / Product Description</th>
          <th style="width:65px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Category</th>
          <th style="width:40px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Recv</th>
          <th style="width:40px; border-right:1px solid #000; padding:4px 2px; text-align:center; color:#b91c1c;">Damaged</th>
          <th style="width:40px; border-right:1px solid #000; padding:4px 2px; text-align:center; color:#d97706;">Missing</th>
          <th style="width:45px; border-right:1px solid #000; padding:4px 2px; text-align:center; font-weight:800;">Return</th>
          <th style="width:65px; border-right:1px solid #000; padding:4px 4px; text-align:right;">Rate (₹)</th>
          <th style="width:75px; padding:4px 6px; text-align:right;">Claim (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        <!-- Integrated Totals -->
        <tr style="border-top:1px solid #000;">
          <td colspan="5" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="3" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">Subtotal Claim</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(subTotal)}</td>
        </tr>
        <tr style="border-bottom:1px solid #000;">
          <td colspan="5" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="3" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">GST Adjustment</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(gstTotal)}</td>
        </tr>
        <tr style="font-weight:800; font-size:10.5px; border-bottom:1.5px solid #000000;">
          <td colspan="5" style="border-right:1px solid #000; padding:4px 6px; text-align:center;">Total Return Claim</td>
          <td colspan="2" style="border-right:1px solid #000; padding:4px 2px; text-align:center;">${totalReturnQty} Qty</td>
          <td style="border-right:1px solid #000;"></td>
          <td style="padding:4px 6px; text-align:right; font-family:monospace; color:#b91c1c;">${fmtNum(total)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Bottom Section: Words, Terms, Signatures -->
    <div style="display:flex; padding:6px 10px; font-size:9.5px;">
      <!-- Left Column -->
      <div style="flex:1.2; padding-right:15px; border-right:1px solid #000000;">
        <div style="margin-bottom:6px;">
          <span style="font-weight:700;">Total Return Value ( In Words ) :</span><br>
          <span style="font-weight:800; font-size:10px;">${amountInWords}</span>
        </div>
        <div>
          <span style="font-weight:700; text-decoration:underline;">Debit Note Declaration</span>
          <div style="font-size:8.5px; color:#1e293b; line-height:1.3; margin-top:2px;">
            The quantities specified above have been rejected during Quality Control (QC) or received damaged/missing and debited to the vendor ledger account.
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div style="flex:0.8; padding-left:15px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:10px;">
          <span style="font-weight:700;">Debit Amount :</span>
          <span style="font-weight:800; font-family:monospace; color:#b91c1c;">₹${fmtNum(total)}</span>
        </div>

        <div style="text-align:right; margin-top:20px;">
          <div style="font-size:11px; font-weight:800; color:#0284c7;">${companyName.toUpperCase()}</div>
          <div style="font-size:9.5px; font-weight:700; margin-top:25px;">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
