import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));

let staticLogoDataUrl = '';
try {
    const logoBase64 = readFileSync(
        join(__dirname, '../../../public/DigiOptics.png'),
    ).toString('base64');
    staticLogoDataUrl = `data:image/png;base64,${logoBase64}`;
} catch {
    staticLogoDataUrl = '';
}

// Synchronous QR Code SVG Generator for offline and fast PDF compilation
export function generateQRCodeSVG(text, sizePx = 80) {
    try {
        const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
        const modSize = qr.modules.size;
        const data = qr.modules.data;
        let d = '';
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
        return '';
    }
}

export function numberToWordsINR(num) {
    const n = Math.round(Number(num || 0));
    if (!n || isNaN(n)) return 'Zero Rupees Only';

    const a = [
        '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
        'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
        'Seventeen ', 'Eighteen ', 'Nineteen ',
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(val) {
        let str = '';
        if (val > 99) {
            str += a[Math.floor(val / 100)] + 'Hundred ';
            val %= 100;
        }
        if (val > 19) {
            str += b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : ' ');
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

    let words = '';
    if (crore > 0) words += inWords(crore) + 'Crore ';
    if (lakh > 0) words += inWords(lakh) + 'Lakh ';
    if (thousand > 0) words += inWords(thousand) + 'Thousand ';
    if (hundreds > 0) words += inWords(hundreds);

    return (words.trim() ? words.trim() : 'Zero') + ' Rupees Only';
}

const fmtPower = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    if (num > 0) return `+${num.toFixed(2)}`;
    return num.toFixed(2);
};

const fmtAxis = (val) => {
    if (val === undefined || val === null || val === '') return '0';
    const num = Number(val);
    return isNaN(num) ? String(val) : String(Math.round(num));
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-');

/**
 * Clean, classic Indian Optical GST Sale Invoice & Delivery Challan layout
 * Matches standardized optical wholesale billing layout without emojis.
 */
export function renderOpticalDocumentHTML(data, docType = 'INVOICE') {
    const isChallan = docType === 'CHALLAN';
    const title = isChallan ? 'Delivery Challan' : 'Sale Invoice';
    const numberLabel = isChallan ? 'Challan No :' : 'Invoice No :';
    const dateLabel = isChallan ? 'Challan Date :' : 'Invoice Date :';

    // Logo resolution: use uploaded logo if present, else fallback to static DigiOptics logo
    const uploadedLogo = (data.companyLogo && String(data.companyLogo).trim()) ||
                         (data.company?.logo && String(data.company.logo).trim()) ||
                         '';
    const finalLogo = uploadedLogo || staticLogoDataUrl;

    const wholesalerName = data.companyName || data.company?.name || 'SAANCHI & CO.';
    const wholesalerAddress = data.companyAddress || data.company?.addressLine1 || '3RD FLOOR, PEOPLES TV BUILDING, RAJA RAMMOHAN ROY ROAD,\nHAKIMPARA, SILIGURI';
    const wholesalerPhone = data.companyPhone || data.company?.phone || '0353-4075631';
    const wholesalerGstin = data.companyGstin || data.company?.gstin || '19AFWFS3883G1Z2';

    const customerName = data.customerName || data.billTo?.name || 'Customer';
    const customerPhone = data.customerPhone || data.billTo?.contactNumber || 'N/A';
    const customerGstin = data.customerGstin || data.billTo?.gstin || '';
    const customerAddress = data.customerAddress || data.billTo?.address || 'N/A';

    const docNumber = data.invoiceNo || data.billNumber || 'DOC-001';
    const docDate = data.invoiceDate || data.orderDate || new Date();
    const deliveryDate = data.deliveryDate || null;
    const deliveryBy = data.deliveryBy || '60';

    const orders = Array.isArray(data.orders) && data.orders.length > 0 ? data.orders : [];
    let itemIndex = 1;
    let parsedItems = [];
    let subTotal = 0;
    let totalQty = 0;
    let hsnMap = new Map();

    const accumulateHsn = (hsn, taxable, cgstRate, sgstRate, igstRate) => {
        const key = hsn || '90015000';
        if (!hsnMap.has(key)) {
            hsnMap.set(key, { taxable: 0, cgstRate, sgstRate, igstRate });
        }
        const entry = hsnMap.get(key);
        entry.taxable += taxable;
    };

    if (orders.length > 0) {
        for (const order of orders) {
            const cgstRate = parseFloat(order.cgst || 2.5);
            const sgstRate = parseFloat(order.sgst || 2.5);
            const igstRate = parseFloat(order.igst || 0);

            for (const item of (order.items || [])) {
                const itemName = item.itemName || 'Optical Item';
                const hsn = item.hsnSac || '90015000';
                const price = Number(item.price || item.sellingPrice || 0);
                const discPct = Number(item.discountPercent || 0);
                const discAmt = Number(item.discountAmount || 0);
                const rxRef = item.rx?.orderReference || (order.orderNumber ? `Rx Order No. - ${order.orderNumber}` : '');

                const powers = item.rx?.powers || [];
                const rPower = powers.find(p => p.side === 'R' || p.side === 'Right');
                const lPower = powers.find(p => p.side === 'L' || p.side === 'Left');

                if (rPower && lPower) {
                    const rQty = 1;
                    const rPrice = price;
                    const rDiscAmt = discAmt > 0 ? (discAmt / 2) : (rPrice * rQty * discPct / 100);
                    const rAmt = (rPrice * rQty) - rDiscAmt;
                    parsedItems.push({
                        sn: itemIndex++,
                        itemName,
                        rxRef,
                        eye: 'R',
                        sph: fmtPower(rPower.sph),
                        cyl: fmtPower(rPower.cyl),
                        axis: fmtAxis(rPower.axis),
                        add: fmtPower(rPower.add),
                        qty: rQty,
                        price: rPrice,
                        discPct,
                        discAmt: rDiscAmt,
                        amt: rAmt,
                    });
                    subTotal += rAmt;
                    totalQty += rQty;
                    accumulateHsn(hsn, rAmt, cgstRate, sgstRate, igstRate);

                    const lQty = 1;
                    const lPrice = price;
                    const lDiscAmt = discAmt > 0 ? (discAmt / 2) : (lPrice * lQty * discPct / 100);
                    const lAmt = (lPrice * lQty) - lDiscAmt;
                    parsedItems.push({
                        sn: itemIndex++,
                        itemName,
                        rxRef,
                        eye: 'L',
                        sph: fmtPower(lPower.sph),
                        cyl: fmtPower(lPower.cyl),
                        axis: fmtAxis(lPower.axis),
                        add: fmtPower(lPower.add),
                        qty: lQty,
                        price: lPrice,
                        discPct,
                        discAmt: lDiscAmt,
                        amt: lAmt,
                    });
                    subTotal += lAmt;
                    totalQty += lQty;
                    accumulateHsn(hsn, lAmt, cgstRate, sgstRate, igstRate);
                } else if (rPower || lPower) {
                    const p = rPower || lPower;
                    const side = rPower ? 'R' : 'L';
                    const qty = Number(item.qty || 1);
                    const iDiscAmt = discAmt > 0 ? discAmt : (price * qty * discPct / 100);
                    const iAmt = (price * qty) - iDiscAmt;
                    parsedItems.push({
                        sn: itemIndex++,
                        itemName,
                        rxRef,
                        eye: side,
                        sph: fmtPower(p.sph),
                        cyl: fmtPower(p.cyl),
                        axis: fmtAxis(p.axis),
                        add: fmtPower(p.add),
                        qty,
                        price,
                        discPct,
                        discAmt: iDiscAmt,
                        amt: iAmt,
                    });
                    subTotal += iAmt;
                    totalQty += qty;
                    accumulateHsn(hsn, iAmt, cgstRate, sgstRate, igstRate);
                } else {
                    const qty = Number(item.qty || 1);
                    const iDiscAmt = discAmt > 0 ? discAmt : (price * qty * discPct / 100);
                    const iAmt = (price * qty) - iDiscAmt;
                    const hasPower = item.sph !== undefined || item.cyl !== undefined;
                    parsedItems.push({
                        sn: itemIndex++,
                        itemName,
                        rxRef: item.code ? `Item Code: ${item.code}` : '',
                        eye: item.side || '-',
                        sph: hasPower ? fmtPower(item.sph) : '-',
                        cyl: hasPower ? fmtPower(item.cyl) : '-',
                        axis: hasPower ? fmtAxis(item.axis) : '-',
                        add: hasPower ? fmtPower(item.add) : '-',
                        qty,
                        price,
                        discPct,
                        discAmt: iDiscAmt,
                        amt: iAmt,
                    });
                    subTotal += iAmt;
                    totalQty += qty;
                    accumulateHsn(hsn, iAmt, cgstRate, sgstRate, igstRate);
                }
            }
        }
    } else if (Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
            const qty = Number(item.quantity || item.qty || 1);
            const price = Number(item.unitRate || item.price || 0);
            const discAmt = Number(item.discount || item.discountAmount || 0);
            const amt = Number(item.netValue || item.value || (price * qty - discAmt));
            const hsn = item.hsn || item.hsnSac || '90015000';
            parsedItems.push({
                sn: itemIndex++,
                itemName: item.materialDescription || item.itemName || 'Optical Item',
                rxRef: item.orderNo ? `Rx Order No. - ${item.orderNo}` : '',
                eye: item.eye || '-',
                sph: item.sph ? fmtPower(item.sph) : '-',
                cyl: item.cyl ? fmtPower(item.cyl) : '-',
                axis: item.axis ? fmtAxis(item.axis) : '-',
                add: item.add ? fmtPower(item.add) : '-',
                qty,
                price,
                discPct: Number(item.discountPercent || 0),
                discAmt,
                amt,
            });
            subTotal += amt;
            totalQty += qty;
            accumulateHsn(hsn, amt, 2.5, 2.5, 0);
        }
    }

    const shippingCharges = Number(data.shippingCharges || 0);
    const otherCharges = Number(data.otherCharges || 0);

    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTaxable = 0;
    const hsnRows = [];

    for (const [hsn, info] of hsnMap.entries()) {
        const sgst = (info.taxable * info.sgstRate) / 100;
        const cgst = (info.taxable * info.cgstRate) / 100;
        const igst = (info.taxable * info.igstRate) / 100;
        const rowTax = sgst + cgst + igst;
        totalTaxable += info.taxable;
        totalSgst += sgst;
        totalCgst += cgst;
        totalIgst += igst;
        hsnRows.push({
            hsn,
            taxable: info.taxable,
            sgstRate: info.sgstRate,
            sgst,
            cgstRate: info.cgstRate,
            cgst,
            igstRate: info.igstRate,
            igst,
            totalTax: rowTax,
        });
    }

    const finalCgst = Number(data.cgstAmount ?? totalCgst);
    const finalSgst = Number(data.sgstAmount ?? totalSgst);
    const finalIgst = Number(data.igstAmount ?? totalIgst);
    const totalTaxes = finalCgst + finalSgst + finalIgst;

    const rawGrandTotal = subTotal + shippingCharges + otherCharges + totalTaxes;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

    const paidAmount = Number(data.paidAmount ?? data.totalPaidAmount ?? data.advanceAmount ?? 0);
    const dueAmount = Math.max(0, grandTotal - paidAmount);
    const amountInWords = numberToWordsINR(grandTotal);

    const bankAccountNo = data.bankAccountNo || data.bankDetails?.bankAccountNo || '0828073000000655';
    const bankIFSC = data.bankIFSC || data.bankDetails?.bankIFSC || 'SIBL0000828';
    const bankName = data.bankName || data.bankDetails?.bankName || 'South Indian Bank Ltd.';
    const bankBranch = data.bankBranch || data.bankDetails?.bankBranch || 'Siliguri Branch.';

    const upiId = data.upiId || data.bankDetails?.upiId || 'saanchi@upi';
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(wholesalerName)}&am=${dueAmount > 0 ? dueAmount.toFixed(2) : grandTotal.toFixed(2)}&cu=INR`;
    const qrCodeSvg = generateQRCodeSVG(upiString, 85);

    const renderedItemRows = parsedItems.map((item) => `
    <tr style="border-bottom:1px solid #000000;">
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px;">${item.sn}</td>
      <td style="border-right:1px solid #000; padding:3px 6px; text-align:left; vertical-align:top;">
        <div style="font-weight:700; font-size:10px; color:#000; text-transform:uppercase;">${item.itemName}</div>
        ${item.rxRef ? `<div style="font-size:9px; color:#334155; margin-top:1px;">${item.rxRef}</div>` : ''}
      </td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-weight:700; font-size:10px;">${item.eye}</td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px; font-family:monospace;">${item.sph}</td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px; font-family:monospace;">${item.cyl}</td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px; font-family:monospace;">${item.axis}</td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px; font-family:monospace;">${item.add}</td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px; font-weight:600;">${item.qty}</td>
      <td style="border-right:1px solid #000; padding:3px 4px; text-align:right; vertical-align:top; font-size:10px; font-family:monospace;">${fmtNum(item.price)}</td>
      <td style="border-right:1px solid #000; padding:3px 2px; text-align:center; vertical-align:top; font-size:10px;">${item.discPct || '0'}</td>
      <td style="border-right:1px solid #000; padding:3px 4px; text-align:right; vertical-align:top; font-size:10px; font-family:monospace;">${fmtNum(item.discAmt)}</td>
      <td style="padding:3px 6px; text-align:right; vertical-align:top; font-size:10px; font-weight:700; font-family:monospace;">${fmtNum(item.amt)}</td>
    </tr>
  `).join('');

    const hsnRowsHtml = hsnRows.map(r => `
    <tr style="border-bottom:1px solid #000000;">
      <td style="border-right:1px solid #000; padding:2px 4px; font-family:monospace;">${r.hsn}</td>
      <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(r.taxable)}</td>
      <td style="border-right:1px solid #000; padding:2px 4px;">${r.sgstRate.toFixed(2)}</td>
      <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(r.sgst)}</td>
      <td style="border-right:1px solid #000; padding:2px 4px;">${r.cgstRate.toFixed(2)}</td>
      <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(r.cgst)}</td>
      <td style="border-right:1px solid #000; padding:2px 4px;">${r.igstRate.toFixed(2)}</td>
      <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(r.igst)}</td>
      <td style="padding:2px 4px; text-align:right; font-weight:700; font-family:monospace;">${fmtNum(r.totalTax)}</td>
    </tr>
  `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${docNumber}</title>
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
        ${finalLogo ? `<img src="${finalLogo}" alt="Logo" style="max-height:55px; max-width:130px; object-fit:contain;" />` : ''}
      </div>
      <div style="flex:1; text-align:center; padding:0 10px;">
        <div style="font-size:13.5px; font-weight:700; margin-bottom:2px;">${title}</div>
        <div style="font-size:19px; font-weight:800; color:#0284c7; letter-spacing:0.5px; margin-bottom:2px;">${wholesalerName.toUpperCase()}</div>
        <div style="font-size:9.5px; font-weight:600; line-height:1.25; color:#1e293b; white-space:pre-line;">${wholesalerAddress.toUpperCase()}</div>
        <div style="font-size:10px; font-weight:600; color:#1e293b; margin-top:1px;">Contact No. ${wholesalerPhone}</div>
        <div style="font-size:10.5px; font-weight:700; margin-top:2px;">GST No : ${wholesalerGstin}</div>
      </div>
      <div style="width:110px; text-align:right;">
        <div style="font-size:11px; font-weight:700;">Original Copy</div>
      </div>
    </div>

    <!-- Customer & Doc Info 2 Columns -->
    <div style="display:flex; border-bottom:1.5px solid #000000;">
      <!-- Left Column: Party Details -->
      <div style="flex:1.2; padding:6px 10px; border-right:1px solid #000000; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:85px; font-weight:700; vertical-align:top;">Party Name :</td>
            <td style="font-weight:800; font-size:11.5px; color:#000;">${customerName.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-weight:700; vertical-align:top;">Mobile :</td>
            <td style="font-family:monospace; font-weight:600;">${customerPhone}</td>
          </tr>
          ${customerGstin ? `
          <tr>
            <td style="font-weight:700; vertical-align:top;">GST No :</td>
            <td style="font-weight:600; font-family:monospace;">${customerGstin}</td>
          </tr>` : ''}
          <tr>
            <td style="font-weight:700; vertical-align:top;">Address :</td>
            <td style="color:#1e293b;">${customerAddress}</td>
          </tr>
        </table>
      </div>

      <!-- Right Column: Doc Details -->
      <div style="flex:0.8; padding:6px 10px; font-size:10.5px; line-height:1.35;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:95px; font-weight:700;">${numberLabel}</td>
            <td style="font-weight:800; font-family:monospace; font-size:11.5px;">${docNumber}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">${dateLabel}</td>
            <td style="font-weight:700; font-family:monospace;">${fmtDate(docDate)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Delivery Date :</td>
            <td style="font-family:monospace;">${deliveryDate ? fmtDate(deliveryDate) : '-'}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Delivery By :</td>
            <td style="font-weight:600;">${deliveryBy}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width:100%; border-collapse:collapse; border-bottom:1.5px solid #000000;">
      <thead>
        <tr style="background:#ffffff; border-bottom:1px solid #000000; font-size:9.5px; font-weight:700;">
          <th style="width:26px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Sn.</th>
          <th style="border-right:1px solid #000; padding:4px 6px; text-align:left;">Particulars_detail</th>
          <th style="width:26px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Eye</th>
          <th style="width:42px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Sph</th>
          <th style="width:42px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Cyl</th>
          <th style="width:34px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Axis</th>
          <th style="width:42px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Add</th>
          <th style="width:28px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Qty</th>
          <th style="width:55px; border-right:1px solid #000; padding:4px 4px; text-align:right;">Price</th>
          <th style="width:34px; border-right:1px solid #000; padding:4px 2px; text-align:center;">Dis%</th>
          <th style="width:44px; border-right:1px solid #000; padding:4px 4px; text-align:right;">Dis.</th>
          <th style="width:62px; padding:4px 6px; text-align:right;">Amt</th>
        </tr>
      </thead>
      <tbody>
        ${renderedItemRows}
        <!-- Integrated Totals Inside Table Grid -->
        <tr style="border-top:1px solid #000;">
          <td colspan="7" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">Total Value</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(subTotal)}</td>
        </tr>
        <tr style="border-bottom:1px solid #000;">
          <td colspan="7" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">Rounded Off ${roundOff >= 0 ? '(+)' : '(-)'}</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(Math.abs(roundOff))}</td>
        </tr>
        <tr style="border-bottom:1px solid #000;">
          <td colspan="7" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">Freight Charges</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(shippingCharges)}</td>
        </tr>
        ${finalCgst > 0 ? `
        <tr style="border-bottom:1px solid #000;">
          <td colspan="7" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">CGST</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(finalCgst)}</td>
        </tr>` : ''}
        ${finalSgst > 0 ? `
        <tr style="border-bottom:1px solid #000;">
          <td colspan="7" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">SGST</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(finalSgst)}</td>
        </tr>` : ''}
        ${finalIgst > 0 ? `
        <tr style="border-bottom:1px solid #000;">
          <td colspan="7" style="border-right:1px solid #000; border-bottom:1px solid #000;"></td>
          <td colspan="4" style="border-right:1px solid #000; border-bottom:1px solid #000; padding:3px 6px; font-weight:700; text-align:right;">IGST</td>
          <td style="border-bottom:1px solid #000; padding:3px 6px; text-align:right; font-family:monospace; font-weight:600;">${fmtNum(finalIgst)}</td>
        </tr>` : ''}
        <tr style="font-weight:800; font-size:10.5px; border-bottom:1.5px solid #000000;">
          <td colspan="7" style="border-right:1px solid #000; padding:4px 6px; text-align:center;">Total</td>
          <td style="border-right:1px solid #000; padding:4px 2px; text-align:center;">${totalQty}</td>
          <td colspan="3" style="border-right:1px solid #000;"></td>
          <td style="padding:4px 6px; text-align:right; font-family:monospace;">${fmtNum(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- HSN Summary Table -->
    <table style="width:100%; border-collapse:collapse; border-bottom:1.5px solid #000000; font-size:9px; text-align:center;">
      <thead>
        <tr style="border-bottom:1px solid #000; font-weight:700;">
          <th style="border-right:1px solid #000; padding:2px 4px;">HSN</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">Taxable</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">SGST %</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">SGST</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">CGST %</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">CGST</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">IGST %</th>
          <th style="border-right:1px solid #000; padding:2px 4px;">IGST</th>
          <th style="padding:2px 4px;">Total.Tax</th>
        </tr>
      </thead>
      <tbody>
        ${hsnRowsHtml}
        <tr style="border-top:1px solid #000; font-weight:700;">
          <td style="border-right:1px solid #000; padding:2px 4px;">Total</td>
          <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(totalTaxable)}</td>
          <td style="border-right:1px solid #000; padding:2px 4px;"></td>
          <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(totalSgst)}</td>
          <td style="border-right:1px solid #000; padding:2px 4px;"></td>
          <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(totalCgst)}</td>
          <td style="border-right:1px solid #000; padding:2px 4px;"></td>
          <td style="border-right:1px solid #000; padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(totalIgst)}</td>
          <td style="padding:2px 4px; text-align:right; font-family:monospace;">${fmtNum(totalTaxes)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Bottom Section: Words, Terms, Bank, QR Code, Signature -->
    <div style="display:flex; padding:6px 10px; font-size:9.5px;">
      <!-- Left Column -->
      <div style="flex:1.2; padding-right:15px; border-right:1px solid #000000;">
        <div style="margin-bottom:5px;">
          <span style="font-weight:700;">Total Invoice value ( In Words ) :</span><br>
          <span style="font-weight:800; font-size:10px;">${amountInWords}</span>
        </div>
        <div style="margin-bottom:6px;">
          <span style="font-weight:700; text-decoration:underline;">Terms & Condition</span>
          <div style="font-size:8.5px; color:#1e293b; line-height:1.3; margin-top:1px;">
            1.Bills Generated are to be paid in Full. 2.Goods once sold will not be returned back 3.Interest @18% will be charged after the expiry of due date. 4.Cheque dishonour will attract a Penality.
          </div>
        </div>
        <div>
          <span style="font-weight:700; text-decoration:underline;">Bank Details :</span>
          <div style="font-size:9px; line-height:1.3; margin-top:1px;">
            <strong>${wholesalerName.toUpperCase()},</strong><br>
            Account No- ${bankAccountNo}<br>
            IFSC- ${bankIFSC}<br>
            ${bankName},<br>
            ${bankBranch}
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div style="flex:0.8; padding-left:15px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; font-size:10.5px; margin-bottom:2px;">
          <span style="font-weight:700;">Paid Amount :</span>
          <span style="font-weight:700; font-family:monospace;">${fmtNum(paidAmount)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10.5px; margin-bottom:4px;">
          <span style="font-weight:700;">Due Amount :</span>
          <span style="font-weight:800; font-family:monospace; color:${dueAmount > 0 ? '#b91c1c' : '#15803d'};">${fmtNum(dueAmount)}</span>
        </div>

        <div style="text-align:center; margin:2px 0;">
          ${qrCodeSvg}
          <div style="font-size:9px; font-weight:700; margin-top:1px;">Scan To Pay</div>
        </div>

        <div style="text-align:right; margin-top:4px;">
          <div style="font-size:11px; font-weight:800; color:#0284c7;">${wholesalerName.toUpperCase()}</div>
          <div style="font-size:9.5px; font-weight:700; margin-top:20px;">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. SALE / DELIVERY CHALLAN HTML TEMPLATE
 */
export const generateDeliveryChallanHTML = (data) => {
    return renderOpticalDocumentHTML(data, 'CHALLAN');
};

/**
 * 2. SALE INVOICE HTML TEMPLATE
 */
export const generatedorderInvoice = (data) => {
    return renderOpticalDocumentHTML(data, 'INVOICE');
};
