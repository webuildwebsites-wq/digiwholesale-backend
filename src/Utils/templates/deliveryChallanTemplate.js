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

/**
 * 1. SALE / DELIVERY CHALLAN HTML TEMPLATE
 * Designed in DigiOptics Wholesale Enterprise Aesthetic
 */
export const generateDeliveryChallanHTML = (data) => {
    const {
        billNumber,
        orderDate,
        deliveryDate,
        companyName = 'DigiOptics Wholesale',
        companyAddress = 'WeWork Eldeco Centre, Block A, Shivalik Colony, Malviya Nagar, New Delhi 110017',
        companyEmail = 'support@digioptics.com',
        companyPhone = '+91 9650560526',
        companyGstin = 'GST9876543210',
        customerName,
        customerAddress,
        customerPhone,
        orders = [],
    } = data;

    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
    const fmtTime = (d) =>
        d
            ? new Date(d).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            })
            : '-';
    const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let allItems = [];
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let subTotal = 0;
    let totalDiscount = 0;
    let totalQty = 0;

    for (const order of orders) {
        const cgstRate = parseFloat(order.cgst || 0);
        const sgstRate = parseFloat(order.sgst || 0);

        for (const item of order.items || []) {
            const price = Number(item.price || 0);
            const qty = Number(item.qty || 0);
            const discAmt = Number(item.discountAmount || 0);
            const baseAmount = price * qty;
            const amount = baseAmount - discAmt;

            const cgstAmt = (amount * cgstRate) / 100;
            const sgstAmt = (amount * sgstRate) / 100;

            subTotal += amount;
            totalCgst += cgstAmt;
            totalSgst += sgstAmt;
            totalDiscount += discAmt;
            totalQty += qty;

            const powers = item.rx?.powers || [];
            const rPower = powers.find((p) => p.side === 'R');
            const lPower = powers.find((p) => p.side === 'L');

            allItems.push({
                itemName: item.itemName || '-',
                type: item.orderType || '-',
                sph: item.sph ?? rPower?.sph ?? '-',
                cyl: item.cyl ?? rPower?.cyl ?? '-',
                axis: item.axis ?? rPower?.axis ?? '-',
                add: item.add ?? rPower?.add ?? '-',
                qty,
                price,
                discAmt,
                amount,
            });
        }
    }

    const grandTotal = subTotal + totalCgst + totalSgst + totalIgst;

    const itemRows = allItems
        .map(
            (item, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="text-align:center;color:#64748b;font-weight:600;">${i + 1}</td>
            <td style="text-align:left;font-weight:700;color:#0f172a;">${item.itemName}</td>
            <td style="text-align:center;">
              <span class="type-pill ${item.type === 'RX' ? 'pill-rx' : 'pill-stock'}">${item.type}</span>
            </td>
            <td style="text-align:center;color:#334155;">${item.sph}</td>
            <td style="text-align:center;color:#334155;">${item.cyl}</td>
            <td style="text-align:center;color:#334155;">${item.axis}</td>
            <td style="text-align:center;color:#334155;">${item.add}</td>
            <td style="text-align:center;font-weight:700;color:#0f172a;">${item.qty}</td>
            <td style="text-align:right;color:#334155;">₹${fmtNum(item.price)}</td>
            <td style="text-align:right;color:#64748b;">${Number(item.discAmt) > 0 ? `₹${fmtNum(item.discAmt)}` : '-'}</td>
            <td style="text-align:right;font-weight:700;color:#0f172a;">₹${fmtNum(item.amount)}</td>
        </tr>
    `,
        )
        .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sale Challan - ${billNumber || 'DigiOptics'}</title>
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

    .wrap {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        min-height: 100%;
    }

    /* --- TOP HEADER --- */
    .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 14px;
        border-bottom: 2px solid #e2e8f0;
        margin-bottom: 16px;
    }

    .brand-section {
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

    .brand-text h1 {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.3px;
        line-height: 1.2;
    }

    .brand-text p {
        font-size: 10px;
        font-weight: 700;
        color: #0284c7;
        text-transform: uppercase;
        letter-spacing: 0.8px;
    }

    .document-badge {
        text-align: right;
    }

    .badge-title {
        display: inline-block;
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 6px 14px;
        border-radius: 20px;
        box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);
    }

    .badge-number {
        margin-top: 5px;
        font-size: 11px;
        font-weight: 700;
        color: #475569;
    }

    /* --- METADATA & PARTIES GRID --- */
    .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
    }

    .info-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
    }

    .card-label {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #0284c7;
        margin-bottom: 6px;
        border-bottom: 1px dashed #cbd5e1;
        padding-bottom: 4px;
    }

    .party-name {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 4px;
    }

    .info-line {
        font-size: 11px;
        color: #475569;
        line-height: 1.4;
        margin-bottom: 2px;
    }

    .meta-pills {
        display: flex;
        gap: 12px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 16px;
        justify-content: space-between;
    }

    .meta-pill-item {
        font-size: 11px;
    }

    .meta-pill-item strong {
        color: #166534;
        font-weight: 700;
    }

    /* --- TABLE STYLING --- */
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
    }

    thead tr {
        background: #1b6496;
        color: #ffffff;
    }

    th {
        padding: 8px 6px;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border: none;
        border-right: 1px solid rgba(255, 255, 255, 0.15);
    }

    th:last-child {
        border-right: none;
    }

    td {
        padding: 6px 6px;
        border-bottom: 1px solid #e2e8f0;
        border-right: 1px solid #f1f5f9;
        font-size: 10.5px;
        vertical-align: middle;
    }

    td:last-child {
        border-right: none;
    }

    .type-pill {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.3px;
        text-transform: uppercase;
    }

    .pill-rx {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
    }

    .pill-stock {
        background: #e0f2fe;
        color: #0369a1;
        border: 1px solid #bae6fd;
    }

    /* --- TAX & SUMMARY BOX --- */
    .summary-section {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 14px;
        margin-bottom: 16px;
        page-break-inside: avoid;
    }

    .terms-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
    }

    .terms-card h4 {
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        color: #475569;
        margin-bottom: 6px;
    }

    .terms-card ul {
        padding-left: 14px;
        font-size: 10px;
        color: #64748b;
        line-height: 1.4;
    }

    .terms-card ul li {
        margin-bottom: 4px;
    }

    .totals-card {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
    }

    .totals-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 12px;
        font-size: 11px;
        color: #334155;
        border-bottom: 1px solid #f1f5f9;
    }

    .totals-row.grand {
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: #ffffff;
        font-weight: 800;
        font-size: 13px;
        padding: 8px 12px;
        border-bottom: none;
    }

    /* --- FOOTER --- */
    .footer {
        margin-top: auto;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 9.5px;
        color: #94a3b8;
    }

    .footer-stamp {
        font-style: italic;
        font-weight: 500;
    }
</style>
</head>
<body>
<div class="wrap">

    <!-- TOP HEADER -->
    <div class="header-bar">
        <div class="brand-section">
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="DigiOptics" class="brand-logo" />` : ''}
           
        </div>
        <div class="document-badge">
            <div class="badge-title">Sale Challan</div>
            <div class="badge-number">Challan / Ref #: <strong>${billNumber || '—'}</strong></div>
        </div>
    </div>

    <!-- METADATA DATES STRIP -->
    <div class="meta-pills">
        <div class="meta-pill-item">📅 Order Date: <strong>${fmt(orderDate)} (${fmtTime(orderDate)})</strong></div>
        <div class="meta-pill-item">🚚 Delivery Date: <strong>${fmt(deliveryDate)}</strong></div>
        <div class="meta-pill-item">📦 Total Items / Qty: <strong>${allItems.length} items (${totalQty} pcs)</strong></div>
    </div>

    <!-- PARTIES INFO -->
    <div class="info-grid">
        <div class="info-card">
            <div class="card-label">Dispatch From (Supplier)</div>
            <div class="party-name">${companyName}</div>
            <div class="info-line">${companyAddress}</div>
            <div class="info-line">📞 ${companyPhone} | ✉️ ${companyEmail}</div>
            <div class="info-line" style="margin-top:4px;"><strong>GSTIN:</strong> ${companyGstin}</div>
        </div>

        <div class="info-card">
            <div class="card-label">Deliver To (Customer)</div>
            <div class="party-name">${customerName || 'Customer'}</div>
            <div class="info-line">${customerAddress || '—'}</div>
            <div class="info-line">📞 ${customerPhone || '—'}</div>
        </div>
    </div>

    <!-- ITEM TABLE -->
    <table>
        <thead>
            <tr>
                <th style="width:4%;text-align:center;">#</th>
                <th style="width:26%;text-align:left;">Product / Lens Description</th>
                <th style="width:9%;text-align:center;">Type</th>
                <th style="width:7%;text-align:center;">SPH</th>
                <th style="width:7%;text-align:center;">CYL</th>
                <th style="width:7%;text-align:center;">AXIS</th>
                <th style="width:7%;text-align:center;">ADD</th>
                <th style="width:6%;text-align:center;">Qty</th>
                <th style="width:9%;text-align:right;">Rate</th>
                <th style="width:8%;text-align:right;">Disc</th>
                <th style="width:10%;text-align:right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <!-- SUMMARY SECTION -->
    <div class="summary-section">
        <div class="terms-card">
            <h4>Terms & Conditions</h4>
            <ul>
                <li>Goods once delivered and accepted cannot be taken back or exchanged.</li>
                <li>Any discrepancies must be reported within 24 hours of delivery.</li>
                <li>Interest @ 24% p.a. will be levied if payment is delayed beyond credit terms.</li>
                <li>Subject to local jurisdiction only.</li>
            </ul>
        </div>

        <div class="totals-card">
            <div class="totals-row">
                <span>Sub-Total</span>
                <span>₹${fmtNum(subTotal)}</span>
            </div>
            ${totalDiscount > 0 ? `
            <div class="totals-row">
                <span>Total Discount</span>
                <span style="color:#e11d48;">-₹${fmtNum(totalDiscount)}</span>
            </div>` : ''}
            <div class="totals-row">
                <span>SGST</span>
                <span>₹${fmtNum(totalSgst)}</span>
            </div>
            <div class="totals-row">
                <span>CGST</span>
                <span>₹${fmtNum(totalCgst)}</span>
            </div>
            ${totalIgst > 0 ? `
            <div class="totals-row">
                <span>IGST</span>
                <span>₹${fmtNum(totalIgst)}</span>
            </div>` : ''}
            <div class="totals-row grand">
                <span>Grand Total</span>
                <span>₹${fmtNum(grandTotal)}</span>
            </div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        <div class="footer-stamp">This is an authenticated computer-generated delivery challan.</div>
        <div>Generated on: ${fmt(new Date())}</div>
    </div>

</div>
</body>
</html>`;
};

/**
 * 2. SALE TAX INVOICE HTML TEMPLATE
 * Designed in DigiOptics Wholesale Enterprise Aesthetic
 */
export const generatedorderInvoice = (data) => {
    const {
        invoiceNo,
        invoiceDate,
        irnNo,
        placeOfSupply,
        company = {},
        billTo = {},
        shipTo = {},
        items = [],
        totalQty = 0,
        grossAmount = 0,
        discountAmount = 0,
        taxableAmount = 0,
        cgstAmount = 0,
        sgstAmount = 0,
        igstAmount = 0,
        grandTotal = 0,
        qrCode = '',
    } = data;

    const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemRows = items
        .map(
            (item, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="font-size:10px;padding:6px 5px;text-align:center;color:#64748b;">${idx + 1}</td>
            <td style="font-size:10.5px;padding:6px 6px;">
                <strong style="color:#0284c7;">${item.orderNo || '—'}</strong>
                ${item.dcNo ? `<div style="font-size:9.5px;color:#64748b;">(DC: ${item.dcNo})</div>` : ''}
                <div style="font-size:9.5px;color:#94a3b8;">${item.orderDate || ''}</div>
            </td>
            <td style="font-size:10px;padding:6px 5px;text-align:center;font-family:monospace;font-weight:600;color:#334155;">
                ${item.referenceNo || '—'}
            </td>
            <td style="font-size:10.5px;padding:6px 6px;text-align:left;font-weight:700;color:#0f172a;">
                ${item.materialDescription || '—'}
            </td>
            <td style="font-size:10px;padding:6px 5px;text-align:center;color:#64748b;">
                ${item.hsn || '—'}
            </td>
            <td style="font-size:11px;padding:6px 5px;text-align:center;font-weight:700;color:#0f172a;">
                ${item.quantity || 0}
            </td>
            <td style="font-size:10.5px;padding:6px 6px;text-align:right;color:#334155;">
                ₹${fmtNum(item.unitRate)}
            </td>
            <td style="font-size:10.5px;padding:6px 6px;text-align:right;color:#334155;">
                ₹${fmtNum(item.value)}
            </td>
            <td style="font-size:10px;padding:6px 5px;text-align:center;color:#64748b;">
                ${Number(item.discount) > 0 ? `${item.discount}%` : '-'}
            </td>
            <td style="font-size:11px;padding:6px 6px;text-align:right;font-weight:700;color:#0f172a;">
                ₹${fmtNum(item.netValue)}
            </td>
        </tr>
    `,
        )
        .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Tax Invoice - ${invoiceNo || 'DigiOptics'}</title>
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
.invoice-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
}

/* TITLE HEADER */
.title-header {
    background: linear-gradient(135deg, #1b6496, #0284c7);
    color: #ffffff;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.title-main {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
}
.title-sub {
    font-size: 10.5px;
    font-weight: 600;
    opacity: 0.9;
}

/* SUPPLIER & METADATA SECTION */
.header-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    border-bottom: 1px solid #e2e8f0;
}
.company-cell {
    padding: 12px 16px;
    border-right: 1px solid #e2e8f0;
}
.company-name {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.company-info {
    font-size: 10.5px;
    color: #475569;
    line-height: 1.4;
}
.meta-cell {
    padding: 12px 16px;
    background: #f8fafc;
}
.meta-table {
    width: 100%;
    border-collapse: collapse;
}
.meta-table td {
    padding: 2.5px 0;
    font-size: 10.5px;
    border: none;
}
.meta-table td.label {
    font-weight: 700;
    color: #475569;
    width: 38%;
}
.meta-table td.val {
    color: #0f172a;
    font-weight: 600;
}

/* BILL TO & SHIP TO */
.parties-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #e2e8f0;
}
.party-box {
    padding: 10px 16px;
}
.party-box:first-child {
    border-right: 1px solid #e2e8f0;
}
.party-heading {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: #0284c7;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}
.party-title {
    font-size: 12.5px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 2px;
}
.party-text {
    font-size: 10.5px;
    color: #475569;
    line-height: 1.35;
}

/* TABLE */
.item-table {
    width: 100%;
    border-collapse: collapse;
}
.item-table th {
    background: #1b6496;
    color: #ffffff;
    font-weight: 700;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 7px 5px;
    text-align: center;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
}
.item-table th:last-child {
    border-right: none;
}
.item-table td {
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #f1f5f9;
}
.item-table td:last-child {
    border-right: none;
}

/* SUMMARY */
.summary-grid {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    border-bottom: 1px solid #e2e8f0;
    page-break-inside: avoid;
}
.words-box {
    padding: 12px 16px;
    border-right: 1px solid #e2e8f0;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.words-title {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 4px;
}
.words-val {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
}
.summary-table-box {
    padding: 0;
}
.summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4.5px 14px;
    font-size: 10.5px;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
}
.summary-row.grand {
    background: linear-gradient(135deg, #1b6496, #0284c7);
    color: #ffffff;
    font-weight: 800;
    font-size: 12.5px;
    padding: 7px 14px;
    border-bottom: none;
}

/* FOOTER NOTE */
.footer-note {
    text-align: center;
    font-size: 9.5px;
    color: #64748b;
    padding: 8px;
    background: #f8fafc;
}
</style>
</head>
<body>
<div class="invoice-container">

    <!-- TITLE HEADER -->
    <div class="title-header">
        <div class="title-main">TAX INVOICE</div>
        <div class="title-sub">ORIGINAL FOR RECIPIENT</div>
    </div>

    <!-- SUPPLIER & METADATA -->
    <div class="header-grid">
        <div class="company-cell">
            <div class="company-name" style="margin-bottom: 8px;">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="DigiOptics" style="height:70px;max-width:300px;object-fit:contain;display:block;" />` : ''}
            </div>
            <div class="company-info">WeWork Eldeco Centre, Block A, Shivalik Colony</div>
            <div class="company-info">Malviya Nagar, New Delhi, Delhi 110017</div>
            ${company.gstin ? `<div class="company-info" style="margin-top:4px;"><strong>GSTIN:</strong> ${company.gstin}</div>` : ''}
            ${company.stateCode ? `<div class="company-info"><strong>State Code:</strong> ${company.stateCode}</div>` : ''}
        </div>
        <div class="meta-cell">
            <table class="meta-table">
                <tr>
                    <td class="label">Invoice No</td>
                    <td class="val">: ${invoiceNo || '—'}</td>
                </tr>
                <tr>
                    <td class="label">Invoice Date</td>
                    <td class="val">: ${invoiceDate || '—'}</td>
                </tr>
                ${irnNo ? `
                <tr>
                    <td class="label">IRN No</td>
                    <td class="val" style="font-family:monospace;font-size:9.5px;">: ${irnNo}</td>
                </tr>` : ''}
                <tr>
                    <td class="label">Place of Supply</td>
                    <td class="val">: ${placeOfSupply || '—'}</td>
                </tr>
            </table>
        </div>
    </div>

    <!-- PARTIES -->
    <div class="parties-grid">
        <div class="party-box">
            <div class="party-heading">Bill To (Buyer)</div>
            <div class="party-title">${billTo.name || '—'}</div>
            ${billTo.branchName ? `<div class="party-text"><strong>${billTo.branchName}</strong></div>` : ''}
            ${billTo.address ? `<div class="party-text">${billTo.address}</div>` : ''}
            ${(billTo.city || billTo.state || billTo.pincode) ? `<div class="party-text">${[billTo.city, billTo.state, billTo.pincode].filter(Boolean).join(', ')}</div>` : ''}
            ${billTo.contactNumber ? `<div class="party-text">📞 ${billTo.contactNumber}</div>` : ''}
            ${billTo.gstin ? `<div class="party-text" style="margin-top:3px;"><strong>GSTIN:</strong> ${billTo.gstin}</div>` : ''}
        </div>
        <div class="party-box">
            <div class="party-heading">Ship To (Consignee)</div>
            <div class="party-title">${shipTo.name || '—'}</div>
            ${shipTo.branchName ? `<div class="party-text"><strong>${shipTo.branchName}</strong></div>` : ''}
            ${shipTo.address ? `<div class="party-text">${shipTo.address}</div>` : ''}
            ${(shipTo.city || shipTo.state || shipTo.pincode) ? `<div class="party-text">${[shipTo.city, shipTo.state, shipTo.pincode].filter(Boolean).join(', ')}</div>` : ''}
            ${shipTo.contactNumber ? `<div class="party-text">📞 ${shipTo.contactNumber}</div>` : ''}
        </div>
    </div>

    <!-- ITEM TABLE -->
    <table class="item-table">
        <thead>
            <tr>
                <th style="width:4%;">#</th>
                <th style="width:14%;">Order / DC No</th>
                <th style="width:10%;">Ref Code</th>
                <th style="width:28%;text-align:left;">Material / Product Description</th>
                <th style="width:7%;">HSN</th>
                <th style="width:6%;">Qty</th>
                <th style="width:9%;text-align:right;">Rate</th>
                <th style="width:9%;text-align:right;">Value</th>
                <th style="width:5%;">Disc</th>
                <th style="width:8%;text-align:right;">Net Value</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <!-- SUMMARY SECTION -->
    <div class="summary-grid">
        <div class="words-box">
            <div>
                <div class="words-title">Amount in Words</div>
                <div class="words-val">₹ ${fmtNum(grandTotal)} Only</div>
            </div>
            <div style="font-size:10px;color:#94a3b8;margin-top:8px;">
                Total Items: <strong>${items.length}</strong> | Total Pieces: <strong>${totalQty}</strong>
            </div>
        </div>
        <div class="summary-table-box">
            <div class="summary-row">
                <span>Gross Taxable Amount</span>
                <span>₹ ${fmtNum(grossAmount)}</span>
            </div>
            ${Number(discountAmount) > 0 ? `
            <div class="summary-row">
                <span>Discount</span>
                <span style="color:#e11d48;">-₹ ${fmtNum(discountAmount)}</span>
            </div>` : ''}
            <div class="summary-row">
                <span>Taxable Amount</span>
                <span>₹ ${fmtNum(taxableAmount)}</span>
            </div>
            <div class="summary-row">
                <span>CGST + SGST</span>
                <span>₹ ${fmtNum(Number(cgstAmount) + Number(sgstAmount))}</span>
            </div>
            ${Number(igstAmount) > 0 ? `
            <div class="summary-row">
                <span>IGST</span>
                <span>₹ ${fmtNum(igstAmount)}</span>
            </div>` : ''}
            <div class="summary-row grand">
                <span>Grand Total</span>
                <span>₹ ${fmtNum(grandTotal)}</span>
            </div>
        </div>
    </div>

    <!-- FOOTER NOTE -->
    <div class="footer-note">
        This is an authenticated computer-generated GST tax invoice. No signature required.
    </div>

</div>
</body>
</html>`;
};
