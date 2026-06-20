import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoBase64 = readFileSync(
  join(__dirname, '../../../public/DigiOptics.png'),
).toString('base64');
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

export const generateDeliveryChallanHTML = (data) => {
  const {
    billNumber,
    orderDate,
    deliveryDate,
    companyName,
    companyAddress,
    companyEmail,
    companyPhone,
    companyGstin,
    customerName,
    customerAddress,
    customerPhone,
    orders = [],
  } = data;

  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');
  const fmtTime = (d) =>
    d
      ? new Date(d).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';
  const fmtNum = (n) => Number(n || 0).toFixed(2);

  let allItems = [];
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let subTotal = 0;
  let totalDiscount = 0;

  for (const order of orders) {
    const cgstRate = parseFloat(order.cgst || 0);
    const sgstRate = parseFloat(order.sgst || 0);

    for (const item of order.items) {
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
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#ddeeff'}">
            <td>${item.itemName}</td>
            <td>${item.type}</td>
            <td>${item.sph}</td>
            <td>${item.cyl}</td>
            <td>${item.axis}</td>
            <td>${item.add}</td>
            <td>${item.qty}</td>
            <td>₹${fmtNum(item.price)}</td>
            <td>₹${fmtNum(item.discAmt)}</td>
            <td>₹${fmtNum(item.amount)}</td>
        </tr>
    `,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sale Challan</title>
<style>
    @page {
    size: A4;
    margin: 24px;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html,
body {
    height: 100%;
}

body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: #222;
    min-height: 100vh;
}

.wrap {
    max-width: 800px;
    margin: auto;
    padding: 20px;
    min-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
}

.main-content {
    flex: 1;
}

.top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
}

.top-left p {
    margin-bottom: 3px;
}

.top-left strong {
    font-weight: bold;
}

.top-center {
    text-align: center;
}

.challan-title {
    font-size: 14px;
    font-weight: bold;
    margin-top: 4px;
}

.top-right {
    text-align: right;
}

.top-right p {
    margin-bottom: 3px;
}

.customer-details {
    margin-top: 8px;
}

.customer-details p {
    margin-bottom: 2px;
}

.divider {
    border: none;
    border-top: 1.5px solid #bbb;
    margin: 14px 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
}

thead tr {
    background: #cce0f5;
}

th {
    padding: 8px 6px;
    text-align: center;
    font-weight: bold;
    font-size: 11px;
    border: 1px solid #b0c8e0;
}

td {
    padding: 7px 6px;
    text-align: center;
    border: 1px solid #d0dce8;
    font-size: 11px;
}

td:first-child {
    text-align: left;
}

.tax-box {
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 14px;
    margin-bottom: 20px;
}

.tax-box .tax-title {
    font-weight: bold;
    font-size: 12px;
    margin-bottom: 10px;
}

.tax-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.tax-row .tax-col {
    flex: 1;
}

.tax-row .tax-col .label {
    font-weight: bold;
    font-size: 11px;
    margin-bottom: 3px;
}

.tax-row .tax-col .val {
    font-size: 12px;
}

.tax-divider {
    border: none;
    border-top: 1px solid #ddd;
    margin: 8px 0;
}

.footer {
    margin-top: auto;
    padding-top: 12px;
    font-size: 10px;
    color: #444;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #ddd;
}

.footer ul {
    padding-left: 14px;
}

.footer ul li {
    margin-bottom: 3px;
}

.footer .sig {
    font-style: italic;
    font-size: 10px;
}
</style>
</head>
<body>
<div class="wrap">

    <div class="top">
        <div class="top-left">
            <p><strong>Bill Number:</strong> ${billNumber}</p>
            <p><strong>Company Name:</strong> ${companyName}</p>
            <p><strong>Address:</strong> ${companyAddress}</p>
            <p><strong>Email:</strong> ${companyEmail}</p>
            <p><strong>Phone:</strong> ${companyPhone}</p>
            <p><strong>GSTIN:</strong> ${companyGstin}</p>
        </div>

        <div class="top-center">
            <img src="${logoDataUrl}" alt="DigiOptics" style="height:48px;object-fit:contain;" />
            <div class="challan-title">Sale Challan</div>
        </div>

        <div class="top-right">
            <p><strong>Date of Order:</strong> ${fmt(orderDate)}</p>
            <p><strong>Time of Order:</strong> ${fmtTime(orderDate)}</p>
            <p><strong>Date of Delivery:</strong> ${fmt(deliveryDate)}</p>
            <div class="customer-details">
                <p><strong>CUSTOMER DETAILS:</strong></p>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Address:</strong> ${customerAddress || '-'}</p>
                <p><strong>Phone:</strong> ${customerPhone || '-'}</p>
            </div>
        </div>
    </div>

    <hr class="divider" />

    <table>
        <thead>
            <tr>
                <th>Product Name</th>
                <th>Type</th>
                <th>Spl.</th>
                <th>Cyl.</th>
                <th>Axis</th>
                <th>Add</th>
                <th>Qty.</th>
                <th>Price</th>
                <th>Disc.</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <div class="tax-box">
        <div class="tax-title">TAX SUMMARY</div>
        <div class="tax-row">
            <div class="tax-col"><div class="label">Sub-Total</div><div class="val">${fmtNum(subTotal)}</div></div>
            <div class="tax-col"><div class="label">Add. Discount</div><div class="val">${fmtNum(totalDiscount)}</div></div>
            <div class="tax-col"><div class="label">SGST</div><div class="val">${fmtNum(totalSgst)}</div></div>
            <div class="tax-col"><div class="label">CGST</div><div class="val">${fmtNum(totalCgst)}</div></div>
            <div class="tax-col"><div class="label">IGST</div><div class="val">${fmtNum(totalIgst)}</div></div>
        </div>
        <hr class="tax-divider" />
        <div class="tax-row">
            <div class="tax-col"><div class="label">Grand Total</div><div class="val">${fmtNum(grandTotal)}</div></div>
            <div class="tax-col"><div class="label">Advanced Paid</div><div class="val">0.00</div></div>
            <div class="tax-col"><div class="label">Balance Due</div><div class="val">${fmtNum(grandTotal)}</div></div>
            <div class="tax-col"><div class="label">Payment Method</div><div class="val">-</div></div>
        </div>
    </div>

    <div class="footer">
        <div class="footer-tc">
            <strong>Terms &amp; Conditions</strong>
            <ul>
                <li>Goods once sold will not be taken back or exchanged</li>
                <li>24% interest will be charged, if the payment is made past the delivery date</li>
            </ul>
        </div>
        <div class="sig">
            No signature required as this is a system generated invoice
        </div>
    </div>

</div>
</body>
</html>`;
};

export const generatedorderInvoice = (data) => {
  const {invoiceNo,invoiceDate,irnNo,placeOfSupply,company = {},billTo = {},shipTo = {},items = [],totalQty = 0,grossAmount = 0,discountAmount = 0,taxableAmount = 0,cgstAmount = 0,sgstAmount = 0,igstAmount = 0,grandTotal = 0, qrCode = '',} = data;
  const itemRows = items
    .map(
      (item, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
            <td style="font-size:11px;padding:5px 4px;">
                <b>${item.orderNo || ''}</b><br/>
                ${item.dcNo ? `( DC No :<br/>${item.dcNo} )<br/>` : ''}
                ${item.orderDate || ''}
            </td>
            <td style="font-size:11px;padding:5px 4px;text-align:center;">${item.referenceNo || ''}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:left;">${item.materialDescription || ''}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:center;">${item.hsn || ''}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:center;">${item.quantity || ''}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:right;">${Number(item.unitRate || 0).toFixed(2)}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:right;">${Number(item.value || 0).toFixed(2)}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:right;">${Number(item.discount || 0).toFixed(2)}</td>
            <td style="font-size:11px;padding:5px 4px;text-align:right;">${Number(item.netValue || 0).toFixed(2)}</td>
        </tr>
    `,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@page {
    size: A4;
    margin: 12px;
}
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #000;
}
.invoice-container {
    width: 100%;
    border: 2px solid #000;
}
.title {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    border-bottom: 2px solid #000;
    padding: 6px 8px;
    letter-spacing: 1px;
}
table {
    width: 100%;
    border-collapse: collapse;
}
td, th {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: top;
}
.header-table td {
    padding: 6px 8px;
    vertical-align: top;
}
.header-table .company-cell {
    width: 60%;
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
}
.header-table .meta-cell {
    width: 40%;
    border-bottom: 1px solid #000;
    padding: 6px 8px;
}
.company-name {
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 4px;
}
.meta-row {
    display: flex;
    margin-bottom: 4px;
    font-size: 12px;
}
.meta-label {
    font-weight: bold;
    white-space: nowrap;
    min-width: 110px;
}
.address-section table {
    border-top: none;
}
.address-section th {
    background: #d9d9d9;
    font-weight: bold;
    font-size: 12px;
    padding: 5px 8px;
    border: 1px solid #000;
}
.address-section td {
    padding: 8px;
    vertical-align: top;
    min-height: 100px;
    font-size: 12px;
    width: 50%;
}
.address-name {
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 4px;
}
.item-table {
    border-top: none;
}
.item-table th {
    background: #d9d9d9;
    font-weight: bold;
    font-size: 11px;
    text-align: center;
    padding: 5px 4px;
    border: 1px solid #000;
}
.item-table tbody tr td {
    border: 1px solid #000;
}
.summary-table td {
    font-size: 12px;
    padding: 4px 8px;
    border: 1px solid #000;
}
.footer-note {
    text-align: center;
    font-style: italic;
    font-size: 11px;
    padding: 8px;
    border-top: 1px solid #000;
}
</style>
</head>
<body>
<div class="invoice-container">

    <div class="title">TAX INVOICE</div>

    <table class="header-table" style="border:none;border-bottom:1px solid #000;">
        <tr>
            <td class="company-cell">
                <div class="company-name">DigiOptics</div>
                <div>WeWork Eldeco Centre, Block A</div>
                <div>Shivalik Colony, Malviya Nagar</div>
                <div>New Delhi, Delhi 110017</div>
                ${company.gstin ? `<div style="margin-top:6px;">GST No. : ${company.gstin}</div>` : ''}
                ${company.stateCode ? `<div>State Code : ${company.stateCode}</div>` : ''}
            </td>
            <td class="meta-cell">
                <table style="border:none;width:100%;">
                    <tr>
                        <td style="border:none;font-weight:bold;white-space:nowrap;padding:3px 4px;">Invoice No</td>
                        <td style="border:none;padding:3px 4px;">: ${invoiceNo || ''}</td>
                    </tr>
                    <tr>
                        <td style="border:none;font-weight:bold;padding:3px 4px;">IRN No</td>
                        <td style="border:none;padding:3px 4px;">: ${irnNo || ''}</td>
                    </tr>
                    <tr>
                        <td style="border:none;font-weight:bold;padding:3px 4px;">Invoice<br/>Date</td>
                        <td style="border:none;padding:3px 4px;">: ${invoiceDate || ''}</td>
                    </tr>
                    <tr>
                        <td style="border:none;font-weight:bold;padding:3px 4px;">Place of<br/>Supply</td>
                        <td style="border:none;padding:3px 4px;">: ${placeOfSupply || ''}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <div class="address-section">
        <table>
            <tr>
                <th style="width:50%;">Bill To</th>
                <th style="width:50%;">Ship To</th>
            </tr>
            <tr>
                <td style="width:50%;min-height:110px;">
                    <div class="address-name">${billTo.name || ''}</div>
                    ${billTo.branchName ? `<div>${billTo.branchName}</div>` : ''}
                    ${billTo.address ? `<div>${billTo.address}</div>` : ''}
                    ${(billTo.city || billTo.state || billTo.pincode) ? `<div>${[billTo.city, billTo.state, billTo.pincode].filter(Boolean).join(', ')}</div>` : ''}
                    ${billTo.contactName ? `<div><b>Contact:</b> ${billTo.contactName}</div>` : ''}
                    ${billTo.contactNumber ? `<div><b>Ph:</b> ${billTo.contactNumber}</div>` : ''}
                    ${billTo.gstin ? `<div style="margin-top:4px;">GSTIN ${billTo.gstin}</div>` : ''}
                </td>
                <td style="width:50%;min-height:110px;">
                    <div class="address-name">${shipTo.name || ''}</div>
                    ${shipTo.branchName ? `<div>${shipTo.branchName}</div>` : ''}
                    ${shipTo.address ? `<div>${shipTo.address}</div>` : ''}
                    ${(shipTo.city || shipTo.state || shipTo.pincode) ? `<div>${[shipTo.city, shipTo.state, shipTo.pincode].filter(Boolean).join(', ')}</div>` : ''}
                    ${shipTo.contactName ? `<div><b>Contact:</b> ${shipTo.contactName}</div>` : ''}
                    ${shipTo.contactNumber ? `<div><b>Ph:</b> ${shipTo.contactNumber}</div>` : ''}
                </td>
            </tr>
        </table>
    </div>

    <table class="item-table">
        <thead>
            <tr>
                <th style="width:13%;">Order No</th>
                <th style="width:9%;">Reference No</th>
                <th style="width:32%;text-align:left;">Material Description</th>
                <th style="width:8%;">HSN</th>
                <th style="width:7%;">Quantity</th>
                <th style="width:9%;">Unit rate</th>
                <th style="width:9%;">Value</th>
                <th style="width:7%;">Discount %</th>
                <th style="width:9%;">Net value</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <table class="summary-table">
        <tr>
            <td style="width:70%;border-right:1px solid #000;" rowspan="6">
                <b>Amount in Words:</b><br/>${grandTotal}
            </td>
            <td style="width:20%;">Total Qty</td>
            <td style="width:10%;text-align:right;">${totalQty}</td>
        </tr>
        <tr>
            <td>Gross Amount</td>
            <td style="text-align:right;">${grossAmount}</td>
        </tr>
        <tr>
            <td>Discount</td>
            <td style="text-align:right;">${discountAmount}</td>
        </tr>
        <tr>
            <td>Taxable Amount</td>
            <td style="text-align:right;">${taxableAmount}</td>
        </tr>
        <tr>
            <td>CGST + SGST</td>
            <td style="text-align:right;">${(Number(cgstAmount) + Number(sgstAmount)).toFixed(2)}</td>
        </tr>
        <tr>
            <td><b>Grand Total</b></td>
            <td style="text-align:right;"><b>${grandTotal}</b></td>
        </tr>
    </table>

    <div class="footer-note">
        This is a system-generated invoice. No signature required.
    </div>

</div>
</body>
</html>`;
};
