import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let logoDataUrl = '';
try {
    const logoBase64 = readFileSync(
        join(__dirname, '../../../public/DigiOptics.png'),
    ).toString('base64');
    logoDataUrl = `data:image/png;base64,${logoBase64}`;
} catch {
    logoDataUrl = '';
}

export const generateVendorOrderInvoiceHTML = (data) => {
    const {
        invoiceNo,
        orderDate,
        receivedDate,
        vendorName,
        vendorAddress,
        vendorPhone,
        vendorEmail,
        vendorGstin,
        companyName = 'DigiOptics Wholesale',
        companyAddress = 'WeWork Eldeco Centre, Block A, Shivalik Colony, Malviya Nagar, New Delhi 110017',
        companyPhone = '+91 9650560526',
        companyEmail = 'support@digioptics.com',
        companyGstin = 'GST9876543210',
        items = [],
        subTotal = 0,
        gstTotal = 0,
        total = 0,
    } = data;

    const orderObj = orderDate ? new Date(orderDate) : new Date();
    const receivedObj = receivedDate ? new Date(receivedDate) : new Date();

    const formattedOrderDate = orderObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedReceivedDate = receivedObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemsRows = items
        .map(
            (item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="text-align:center;color:#64748b;font-weight:600;">${i + 1}</td>
      <td style="text-align:center;font-family:monospace;font-weight:700;color:#0284c7;">${item.productCode || '—'}</td>
      <td style="text-align:center;">
        <span class="cat-pill">${item.category || '—'}</span>
      </td>
      <td style="text-align:left;font-weight:700;color:#0f172a;">${item.name || '—'}</td>
      <td style="text-align:center;font-weight:700;color:#0f172a;">${item.quantity || 0}</td>
      <td style="text-align:right;color:#334155;">₹ ${fmtNum(item.price)}</td>
      <td style="text-align:center;color:#64748b;">${item.gst || 0}%</td>
      <td style="text-align:right;font-weight:700;color:#0f172a;">₹ ${fmtNum(item.total)}</td>
    </tr>
  `,
        )
        .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Vendor Purchase Invoice - ${invoiceNo || 'DigiOptics'}</title>
<style>
@page {
    size: A4 portrait;
    margin: 12mm 10mm;
}
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11.5px;
    color: #1e293b;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.invoice {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
}

/* HEADER */
.header-bar {
    background: linear-gradient(135deg, #1b6496, #0284c7);
    color: #ffffff;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.brand-group {
    display: flex;
    align-items: center;
    gap: 12px;
}
.brand-logo {
    height: 75px;
    max-width: 320px;
    object-fit: contain;
    display: block;
}
.header-title h1 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.5px;
}
.header-title p {
    font-size: 10px;
    opacity: 0.9;
}
.invoice-badge {
    text-align: right;
}
.invoice-badge .pill {
    background: #ffffff;
    color: #0369a1;
    font-size: 12px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 20px;
    display: inline-block;
}
.invoice-badge .num {
    margin-top: 4px;
    font-size: 10.5px;
    opacity: 0.95;
}

/* DATES & METADATA */
.meta-strip {
    display: flex;
    justify-content: space-between;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 16px;
    font-size: 11px;
}

/* GRID */
.grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #e2e8f0;
}
.grid-cell {
    padding: 12px 16px;
}
.grid-cell:first-child {
    border-right: 1px solid #e2e8f0;
}
.cell-heading {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: #0284c7;
    margin-bottom: 6px;
}
.cell-name {
    font-size: 13px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
}
.cell-text {
    font-size: 10.5px;
    color: #475569;
    line-height: 1.4;
}

/* TABLE */
table {
    width: 100%;
    border-collapse: collapse;
}
th {
    background: #1b6496;
    color: #ffffff;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 7px 6px;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
}
th:last-child { border-right: none; }
td {
    padding: 6px 6px;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #f1f5f9;
    font-size: 10.5px;
    vertical-align: middle;
}
td:last-child { border-right: none; }
.cat-pill {
    background: #e0f2fe;
    color: #0369a1;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
}

/* SUMMARY */
.summary-container {
    display: flex;
    justify-content: flex-end;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
}
.summary-table {
    width: 45%;
}
.summary-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 16px;
    font-size: 11px;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
}
.summary-row.total {
    background: linear-gradient(135deg, #1b6496, #0284c7);
    color: #ffffff;
    font-weight: 800;
    font-size: 13px;
    padding: 8px 16px;
    border-bottom: none;
}

/* FOOTER */
.footer {
    padding: 8px 16px;
    background: #f8fafc;
    text-align: center;
    font-size: 9.5px;
    color: #64748b;
}
</style>
</head>
<body>

<div class="invoice">

    <!-- HEADER -->
    <div class="header-bar">
        <div class="brand-group">
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="DigiOptics" class="brand-logo" />` : ''}
           
        </div>
        <div class="invoice-badge">
            <div class="pill">Purchase Invoice</div>
            <div class="num">Invoice #: <strong>${invoiceNo || '—'}</strong></div>
        </div>
    </div>

    <!-- DATES -->
    <div class="meta-strip">
        <div>📅 Order Date: <strong>${formattedOrderDate}</strong></div>
        <div>📥 Inward / Received Date: <strong>${formattedReceivedDate}</strong></div>
        <div>📦 Total Line Items: <strong>${items.length}</strong></div>
    </div>

    <!-- GRID -->
    <div class="grid">
        <div class="grid-cell">
            <div class="cell-heading">Vendor Details (Supplier)</div>
            <div class="cell-name">${vendorName || '—'}</div>
            <div class="cell-text">${vendorAddress || '—'}</div>
            <div class="cell-text">📞 ${vendorPhone || '—'} | ✉️ ${vendorEmail || '—'}</div>
            ${vendorGstin ? `<div class="cell-text" style="margin-top:3px;"><strong>GSTIN:</strong> ${vendorGstin}</div>` : ''}
        </div>
        <div class="grid-cell">
            <div class="cell-heading">Billed & Shipped To (Buyer)</div>
            <div class="cell-name">${companyName}</div>
            <div class="cell-text">${companyAddress}</div>
            <div class="cell-text">📞 ${companyPhone} | ✉️ ${companyEmail}</div>
            ${companyGstin ? `<div class="cell-text" style="margin-top:3px;"><strong>GSTIN:</strong> ${companyGstin}</div>` : ''}
        </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
        <thead>
            <tr>
                <th style="width:4%;">#</th>
                <th style="width:14%;">Product Code</th>
                <th style="width:14%;">Category</th>
                <th style="width:30%;text-align:left;">Item Name</th>
                <th style="width:8%;">Qty</th>
                <th style="width:10%;text-align:right;">Price</th>
                <th style="width:8%;">GST %</th>
                <th style="width:12%;text-align:right;">Total Amount</th>
            </tr>
        </thead>
        <tbody>
            ${itemsRows}
        </tbody>
    </table>

    <!-- SUMMARY -->
    <div class="summary-container">
        <div class="summary-table">
            <div class="summary-row">
                <span>Sub-Total</span>
                <span>₹ ${fmtNum(subTotal)}</span>
            </div>
            <div class="summary-row">
                <span>Total GST</span>
                <span>₹ ${fmtNum(gstTotal)}</span>
            </div>
            <div class="summary-row total">
                <span>Grand Total</span>
                <span>₹ ${fmtNum(total)}</span>
            </div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        This is an authenticated computer-generated vendor purchase document.
    </div>

</div>

</body>
</html>`;
};