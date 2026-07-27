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
  color: #e8710a;
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
  color: #e8710a;
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
  background: #e8710a;
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