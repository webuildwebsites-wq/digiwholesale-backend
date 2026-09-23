// vendor order invoice
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
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    companyGstin,
    items = [],
    subTotal = 0,
    gstTotal = 0,
    total = 0,
    logoUrl
  } = data;

  const orderObj = new Date(orderDate);
  const receivedObj = new Date(receivedDate);

  const formattedOrderDate = orderObj.toLocaleDateString("en-IN");
  const formattedReceivedDate = receivedObj.toLocaleDateString("en-IN");

  const itemsRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.productCode || "-"}</td>
      <td>${item.category || "-"}</td>
      <td>${item.name || ""}</td>
      <td class="right">${item.quantity || 0}</td>
      <td class="right">₹ ${Number(item.price || 0).toFixed(2)}</td>
      <td class="right">${item.gst || 0}%</td>
      <td class="right bold">₹ ${Number(item.total || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Vendor Purchase Invoice</title>

<style>
@page { size: A4; margin: 20px; }

body {
  font-family: Arial, sans-serif;
  font-size: 13px;
  color: #333;
}

.invoice {
  max-width: 800px;
  margin: auto;
  border: 1px solid #ddd;
  padding: 20px;
  border-radius: 8px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h1 {
  color: #2980B9;
  font-size: 28px;
}

.logo img {
  width: 120px;
  object-fit: contain;
}

.section {
  margin-bottom: 18px;
}

.section-title {
  font-weight: bold;
  margin-bottom: 6px;
  color: #2980B9;
  text-transform: uppercase;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

thead {
  background: #2980B9;
  color: #fff;
}

th, td {
  padding: 8px;
  border: 1px solid #ddd;
}

td.right { text-align: right; }
td.bold { font-weight: bold; }

.summary {
  margin-top: 15px;
  width: 50%;
  margin-left: auto;
}

.summary td {
  border: none;
  padding: 5px;
}

.summary .label {
  text-align: right;
  font-weight: 500;
}

.footer {
  margin-top: 30px;
  text-align: center;
  font-size: 12px;
  color: #666;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}
</style>
</head>

<body>

<div class="invoice">

  <div class="header">
    <h1>Purchase Invoice</h1>
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" />` : ""}
    </div>
  </div>

  <div class="section grid">
    <div>
      <div class="section-title">Company Details</div>
      <p><strong>${companyName}</strong></p>
      <p>${companyAddress}</p>
      <p>Phone: ${companyPhone}</p>
      <p>Email: ${companyEmail}</p>
      ${companyGstin ? "<p>GSTIN:" + companyGstin + "</p>" : ""}
    </div>

    <div>
      <div class="section-title">Vendor Details</div>
      <p><strong>${vendorName}</strong></p>
      <p>${vendorAddress}</p>
      <p>Phone: ${vendorPhone}</p>
      <p>Email: ${vendorEmail}</p>
      <p>GSTIN: ${vendorGstin}</p>
    </div>
  </div>

  <div class="section grid">
    <div>
      <p><strong>Invoice No:</strong> ${invoiceNo}</p>
      <p><strong>Order Date:</strong> ${formattedOrderDate}</p>
      <p><strong>Received Date:</strong> ${formattedReceivedDate}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product code</th>
          <th>Category</th>
          <th class="right">Name</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">GST %</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  <table class="summary">
    <tr>
      <td class="label">Sub Total:</td>
      <td class="right">₹ ${subTotal}</td>
    </tr>
    <tr>
      <td class="label">GST:</td>
      <td class="right">₹ ${gstTotal}</td>
    </tr>
    <tr>
      <td class="label bold">Grand Total:</td>
      <td class="right bold">₹ ${total}</td>
    </tr>
  </table>

  <div class="footer">
    <p>This is a system-generated purchase invoice.</p>
    <p>Thank you for your business partnership.</p>
  </div>

</div>

</body>
</html>
`;
};


// vendor return order invoice
export const generateVendorReturnInvoiceHTML = (data) => {
  const {
    invoiceNo,
    returnDate,
    orderDate,
    vendorName,
    vendorAddress,
    vendorPhone,
    vendorEmail,
    vendorGstin,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    companyGstin,
    items = [],
    subTotal = 0,
    gstTotal = 0,
    total = 0,
    logoUrl
  } = data;

  const formattedOrderDate = new Date(orderDate).toLocaleDateString("en-IN");
  const formattedReturnDate = new Date(returnDate).toLocaleDateString("en-IN");

  const itemsRows = items.map((item, i) => {
    const returnQty = (item.damageQty || 0) + (item.missingQty || 0);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${item.productCode || "-"}</td>
        <td>${item.category || "-"}</td>
        <td>${item.name || ""}</td>
        <td class="right">${item.originalQty || 0}</td>
        <td class="right">${item.damageQty || 0}</td>
        <td class="right">${item.missingQty || 0}</td>
        <td class="right bold">${returnQty}</td>
        <td class="right">₹ ${Number(item.price || 0).toFixed(2)}</td>
        <td class="right">${item.gst || 0}%</td>
        <td>${item.remark || "-"}</td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Vendor Return Invoice</title>

<style>
@page { size: A4; margin: 20px; }

body {
  font-family: Arial, sans-serif;
  font-size: 12px;
  color: #333;
}

.invoice {
  max-width: 900px;
  margin: auto;
  border: 1px solid #ddd;
  padding: 20px;
  border-radius: 8px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h1 {
  color: #d32f2f;
  font-size: 26px;
}

.logo img {
  width: 110px;
}

.section {
  margin-bottom: 15px;
}

.section-title {
  font-weight: bold;
  margin-bottom: 6px;
  color: #d32f2f;
  text-transform: uppercase;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 11px;
}

thead {
  background: #d32f2f;
  color: #fff;
}

th, td {
  padding: 6px;
  border: 1px solid #ddd;
}

td.right { text-align: right; }
td.bold { font-weight: bold; }

.summary {
  margin-top: 15px;
  width: 50%;
  margin-left: auto;
}

.summary td {
  border: none;
  padding: 5px;
}

.summary .label {
  text-align: right;
  font-weight: 500;
}

.footer {
  margin-top: 30px;
  text-align: center;
  font-size: 11px;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}
</style>
</head>

<body>

<div class="invoice">

  <div class="header">
    <h1>PURCHASE RETURN</h1>
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" />` : ""}
    </div>
  </div>

  <div class="section grid">
    <div>
      <div class="section-title">Company Details</div>
      <p><strong>${companyName}</strong></p>
      <p>${companyAddress}</p>
      <p>Phone: ${companyPhone}</p>
      <p>Email: ${companyEmail}</p>
      ${companyGstin ? "<p>GSTIN: " + companyGstin + "</p>" : ""}
    </div>

    <div>
      <div class="section-title">Vendor Details</div>
      <p><strong>${vendorName}</strong></p>
      <p>${vendorAddress}</p>
      <p>Phone: ${vendorPhone}</p>
      <p>Email: ${vendorEmail}</p>
      <p>GSTIN: ${vendorGstin}</p>
    </div>
  </div>

  <div class="section grid">
    <div>
      <p><strong>Return Invoice No:</strong> ${invoiceNo}</p>
      <p><strong>Original Order Date:</strong> ${formattedOrderDate}</p>
      <p><strong>Return Date:</strong> ${formattedReturnDate}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Returned Items</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product Code</th>
          <th>Category</th>
          <th>Name</th>
          <th class="right">Ordered Qty</th>
          <th class="right">Damage</th>
          <th class="right">Missing</th>
          <th class="right">Return Qty</th>
          <th class="right">Rate</th>
          <th class="right">GST%</th>
          <th>Remark</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  <table class="summary">
    <tr>
      <td class="label">Return Sub Total:</td>
      <td class="right">₹ ${subTotal}</td>
    </tr>
    <tr>
      <td class="label">GST Adjustment:</td>
      <td class="right">₹ ${gstTotal}</td>
    </tr>
    <tr>
      <td class="label bold">Total Credit Amount:</td>
      <td class="right bold">₹ ${total}</td>
    </tr>
  </table>

  <div class="footer">
    <p>This document is a system-generated Purchase Return / Debit Note.</p>
    <p>Kindly issue credit note for the above returned goods.</p>
  </div>

</div>

</body>
</html>
`;
};
