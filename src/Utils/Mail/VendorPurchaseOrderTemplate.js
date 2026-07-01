const VendorPurchaseOrderTemplate = ({ vendorName, purchaseOrderId, orderDate, orders }) => {
  const fmt = (v) => (v !== undefined && v !== null && v !== "" ? v : "-");
  const fmtNum = (v) => Number(v || 0).toFixed(2);

  const allOrderBlocks = orders.map((order, orderIdx) => {
    const itemRows = order.items.map((item, idx) => {
      const isRx = item.orderType === "RX";
      const rx   = item.rx || {};
      const powers = rx.powers || [];
      const rPower = powers.find(p => p.side === "R") || {};
      const lPower = powers.find(p => p.side === "L") || {};

      const powerSection = isRx ? `
        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;margin:8px 0;">
          <thead>
            <tr style="background:#333;color:#fff;font-size:11px;">
              <th style="padding:5px 8px;text-align:left;">Side</th>
              <th style="padding:5px 8px;">SPH</th>
              <th style="padding:5px 8px;">CYL</th>
              <th style="padding:5px 8px;">AXIS</th>
              <th style="padding:5px 8px;">ADD</th>
              <th style="padding:5px 8px;">DNP</th>
              <th style="padding:5px 8px;">HT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">R</td>
              <td style="padding:4px 8px;">${fmt(rPower.sph)}</td>
              <td style="padding:4px 8px;">${fmt(rPower.cyl)}</td>
              <td style="padding:4px 8px;">${fmt(rPower.axis)}</td>
              <td style="padding:4px 8px;">${fmt(rPower.add)}</td>
              <td style="padding:4px 8px;">${fmt(rPower.dnp)}</td>
              <td style="padding:4px 8px;">${fmt(rPower.ht)}</td>
            </tr>
            <tr style="background:#fafafa;">
              <td style="padding:4px 8px;font-weight:bold;background:#f5f5f5;">L</td>
              <td style="padding:4px 8px;">${fmt(lPower.sph)}</td>
              <td style="padding:4px 8px;">${fmt(lPower.cyl)}</td>
              <td style="padding:4px 8px;">${fmt(lPower.axis)}</td>
              <td style="padding:4px 8px;">${fmt(lPower.add)}</td>
              <td style="padding:4px 8px;">${fmt(lPower.dnp)}</td>
              <td style="padding:4px 8px;">${fmt(lPower.ht)}</td>
            </tr>
          </tbody>
        </table>
        ${rx.coating?.name  ? `<div style="font-size:12px;margin:3px 0;"><b>Coating:</b> ${rx.coating.name}</div>`   : ""}
        ${rx.treatment?.name? `<div style="font-size:12px;margin:3px 0;"><b>Treatment:</b> ${rx.treatment.name}</div>`: ""}
        ${rx.tint?.name     ? `<div style="font-size:12px;margin:3px 0;"><b>Tint:</b> ${rx.tint.name}${rx.tintValue ? ` (${rx.tintValue})` : ""}</div>` : ""}
        ${rx.lab?.name      ? `<div style="font-size:12px;margin:3px 0;"><b>Lab:</b> ${rx.lab.name}</div>`           : ""}
        ${rx.brand?.name    ? `<div style="font-size:12px;margin:3px 0;"><b>Brand:</b> ${rx.brand.name}</div>`       : ""}
        ${rx.remarks        ? `<div style="font-size:12px;margin:3px 0;"><b>Remarks:</b> ${rx.remarks}</div>`        : ""}
        ${(rx.prisms && rx.prisms.length) ? `<div style="font-size:12px;margin:3px 0;"><b>Prism:</b> ${rx.prisms.map(p => `${p.side}: ${p.prism} ${p.base}`).join(" | ")}</div>` : ""}
        ${(rx.centration && rx.centration.length) ? `<div style="font-size:12px;margin:3px 0;"><b>Centration:</b> ${rx.centration.map(c => `${c.side}: PD ${c.pd}, H ${c.fittingHeight}`).join(" | ")}</div>` : ""}
      ` : `
        ${item.sph  != null ? `<div style="font-size:12px;margin:2px 0;"><b>SPH:</b> ${item.sph} &nbsp; <b>CYL:</b> ${fmt(item.cyl)} &nbsp; <b>AXIS:</b> ${fmt(item.axis)} &nbsp; <b>ADD:</b> ${fmt(item.add)}</div>` : ""}
        ${item.coating      ? `<div style="font-size:12px;margin:2px 0;"><b>Coating:</b> ${item.coating}</div>` : ""}
        ${item.tint         ? `<div style="font-size:12px;margin:2px 0;"><b>Tint:</b> ${item.tint}</div>`       : ""}
        ${item.expiry       ? `<div style="font-size:12px;margin:2px 0;"><b>Expiry:</b> ${item.expiry} &nbsp; <b>Disposability:</b> ${fmt(item.disposability)}</div>` : ""}
      `;

      const gross      = Number(item.price || 0) * Number(item.qty || 0);
      const discounted = gross - Number(item.discountAmount || 0);
      const isNew      = item.isNewProduct ? `<span style="background:#10b981;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;margin-left:6px;">NEW</span>` : "";

      return `
        <tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"};">
          <td style="padding:10px 12px;border:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:bold;font-size:13px;">${idx + 1}. ${fmt(item.itemName)}${isNew}</div>
            <div style="font-size:11px;color:#666;margin-top:2px;">${fmt(item.category)} ${item.orderType ? `· ${item.orderType}` : ""} ${item.code ? `· ${item.code}` : ""}</div>
            ${item.brand  ? `<div style="font-size:11px;color:#666;">Brand: ${item.brand}</div>` : ""}
            ${item.index  ? `<div style="font-size:11px;color:#666;">Index: ${item.index}</div>` : ""}
            ${item.color  ? `<div style="font-size:11px;color:#666;">Color: ${item.color}</div>` : ""}
            ${item.size   ? `<div style="font-size:11px;color:#666;">Size: ${item.size}</div>`   : ""}
            ${item.shape  ? `<div style="font-size:11px;color:#666;">Shape: ${item.shape}</div>` : ""}
            ${item.hsnSac ? `<div style="font-size:11px;color:#666;">HSN: ${item.hsnSac}</div>`  : ""}
            ${powerSection}
          </td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:center;vertical-align:top;">
            ${fmt(item.qty)}<br/><span style="font-size:11px;color:#666;">${fmt(item.unit)}</span>
          </td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;vertical-align:top;">
            ₹${fmtNum(item.price)}<br/>
            ${item.gst ? `<span style="font-size:11px;color:#666;">GST: ${item.gst}%</span>` : ""}
          </td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;vertical-align:top;">
            ${item.discountPercent ? `${item.discountPercent}%<br/><span style="font-size:11px;color:#e8710a;">- ₹${fmtNum(item.discountAmount)}</span>` : "-"}
          </td>
          <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;vertical-align:top;font-weight:bold;">
            ₹${fmtNum(discounted)}
          </td>
        </tr>`;
    }).join("");

    const orderTotal = order.items.reduce((sum, item) => {
      const gross = Number(item.price || 0) * Number(item.qty || 0);
      return sum + gross - Number(item.discountAmount || 0);
    }, 0);
    const cgstAmt = (orderTotal * Number(order.cgst || 0)) / 100;
    const sgstAmt = (orderTotal * Number(order.sgst || 0)) / 100;
    const grandTotal = orderTotal + cgstAmt + sgstAmt;

    return `
      <div style="margin-bottom:32px;">
        <div style="background:#e8710a;color:#fff;padding:10px 16px;border-radius:6px 6px 0 0;font-weight:bold;font-size:14px;">
          Order ${orderIdx + 1}: ${fmt(order.orderNumber)}
          ${order.remarks ? `<span style="font-size:12px;font-weight:normal;margin-left:12px;opacity:0.85;">${order.remarks}</span>` : ""}
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;font-size:12px;">
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Item Details</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;white-space:nowrap;">Qty</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;white-space:nowrap;">Unit Rate</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;white-space:nowrap;">Discount</th>
              <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;white-space:nowrap;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-top:0;">
          <tr>
            <td style="width:60%;border:1px solid #e5e7eb;padding:8px 12px;font-size:12px;color:#666;">
              ${order.status ? `Status: <b>${order.status}</b>` : ""}
            </td>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;text-align:right;font-size:12px;">Taxable Amount</td>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;text-align:right;font-size:12px;">₹${fmtNum(orderTotal)}</td>
          </tr>
          <tr style="background:#fafafa;">
            <td style="border:1px solid #e5e7eb;padding:8px 12px;"></td>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;text-align:right;font-size:12px;">CGST (${order.cgst || 0}%)</td>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;text-align:right;font-size:12px;">₹${fmtNum(cgstAmt)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;"></td>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;text-align:right;font-size:12px;">SGST (${order.sgst || 0}%)</td>
            <td style="border:1px solid #e5e7eb;padding:8px 12px;text-align:right;font-size:12px;">₹${fmtNum(sgstAmt)}</td>
          </tr>
          <tr style="background:#fff8f3;">
            <td style="border:1px solid #e5e7eb;padding:10px 12px;"></td>
            <td style="border:1px solid #e5e7eb;padding:10px 12px;text-align:right;font-weight:bold;font-size:13px;">Grand Total</td>
            <td style="border:1px solid #e5e7eb;padding:10px 12px;text-align:right;font-weight:bold;font-size:14px;color:#e8710a;">₹${fmtNum(grandTotal)}</td>
          </tr>
        </table>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Purchase Order — ${purchaseOrderId}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:720px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#e8710a;padding:22px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;letter-spacing:0.5px;">DigiOptics</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">Purchase Order Notification</div>
    </div>

    <div style="padding:20px 28px;background:#fff8f3;border-bottom:2px solid #e8710a;">
      <p style="margin:0 0 6px;font-size:15px;">Dear <b>${fmt(vendorName)}</b>,</p>
      <p style="margin:0;font-size:14px;color:#555;">
        A new purchase order has been placed with you. Please find the complete order details below and process at your earliest convenience.
      </p>
    </div>

    <div style="padding:20px 28px 8px;">
      <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;white-space:nowrap;width:35%;">Purchase Order ID</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:bold;">${fmt(purchaseOrderId)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;">Order Date</td>
          <td style="padding:10px 14px;font-size:13px;">${fmt(orderDate)}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;">Total Orders</td>
          <td style="padding:10px 14px;font-size:13px;">${orders.length}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;">Total Items</td>
          <td style="padding:10px 14px;font-size:13px;">${orders.reduce((sum, o) => sum + o.items.length, 0)}</td>
        </tr>
      </table>

      ${allOrderBlocks}
    </div>

    <div style="background:#f5f5f5;text-align:center;padding:16px 28px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics. This is a system-generated purchase order. Please do not reply to this email.
    </div>

  </div>
</body>
</html>`;
};

export default VendorPurchaseOrderTemplate;
