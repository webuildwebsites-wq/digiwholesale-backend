const VendorOrderUpdatedTemplate = ({ vendorName, purchaseOrderId, orderDate, updatedAt, orders }) => {
  const fmt = (v) => (v !== undefined && v !== null && v !== "" ? v : "-");
  const fmtNum = (v) => Number(v || 0).toFixed(2);

  const allOrderBlocks = orders.map((order, orderIdx) => {
    const itemRows = order.items.map((item, idx) => {
      const gross    = Number(item.price || 0) * Number(item.qty || 0);
      const netValue = gross - Number(item.discountAmount || 0);
      const isNew    = item.isNewProduct
        ? `<span style="background:#10b981;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;margin-left:6px;">NEW</span>`
        : "";

      return `
        <tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"};">
          <td style="padding:9px 12px;border:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:bold;font-size:13px;">${idx + 1}. ${fmt(item.itemName)}${isNew}</div>
            <div style="font-size:11px;color:#666;margin-top:2px;">
              ${fmt(item.category)} ${item.orderType ? `· ${item.orderType}` : ""} ${item.code ? `· ${item.code}` : ""}
            </div>
            ${item.brand  ? `<div style="font-size:11px;color:#888;">Brand: ${item.brand}</div>` : ""}
            ${item.index  ? `<div style="font-size:11px;color:#888;">Index: ${item.index}</div>` : ""}
            ${item.coating? `<div style="font-size:11px;color:#888;">Coating: ${item.coating}</div>` : ""}
          </td>
          <td style="padding:9px 12px;border:1px solid #e5e7eb;text-align:center;">${fmt(item.qty)}<br/><span style="font-size:11px;color:#666;">${fmt(item.unit)}</span></td>
          <td style="padding:9px 12px;border:1px solid #e5e7eb;text-align:right;">₹${fmtNum(item.price)}<br/><span style="font-size:11px;color:#666;">GST: ${item.gst || 0}%</span></td>
          <td style="padding:9px 12px;border:1px solid #e5e7eb;text-align:right;">${item.discountPercent ? `${item.discountPercent}%` : "-"}</td>
          <td style="padding:9px 12px;border:1px solid #e5e7eb;text-align:right;font-weight:bold;">₹${fmtNum(netValue)}</td>
        </tr>`;
    }).join("");

    const taxable  = order.items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 0) - Number(i.discountAmount || 0)), 0);
    const cgstAmt  = (taxable * Number(order.cgst || 0)) / 100;
    const sgstAmt  = (taxable * Number(order.sgst || 0)) / 100;
    const grand    = taxable + cgstAmt + sgstAmt;

    return `
      <div style="margin-bottom:28px;">
        <div style="background:#f59e0b;color:#fff;padding:9px 14px;border-radius:6px 6px 0 0;font-weight:bold;font-size:13px;">
          Order ${orderIdx + 1}: ${fmt(order.orderNumber)}
          ${order.remarks ? `<span style="font-size:12px;font-weight:normal;margin-left:10px;opacity:0.9;">${order.remarks}</span>` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#fef3c7;font-size:12px;">
              <th style="padding:7px 12px;border:1px solid #e5e7eb;text-align:left;">Item</th>
              <th style="padding:7px 12px;border:1px solid #e5e7eb;text-align:center;">Qty</th>
              <th style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right;">Unit Rate</th>
              <th style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right;">Discount</th>
              <th style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#fafafa;">
            <td style="width:60%;border:1px solid #e5e7eb;padding:7px 12px;font-size:12px;color:#666;">Status: <b>${order.status || "Submitted"}</b></td>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;text-align:right;font-size:12px;">Taxable</td>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;text-align:right;font-size:12px;">₹${fmtNum(taxable)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;"></td>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;text-align:right;font-size:12px;">CGST (${order.cgst || 0}%)</td>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;text-align:right;font-size:12px;">₹${fmtNum(cgstAmt)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;"></td>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;text-align:right;font-size:12px;">SGST (${order.sgst || 0}%)</td>
            <td style="border:1px solid #e5e7eb;padding:7px 12px;text-align:right;font-size:12px;">₹${fmtNum(sgstAmt)}</td>
          </tr>
          <tr style="background:#fffbeb;">
            <td style="border:1px solid #e5e7eb;padding:9px 12px;"></td>
            <td style="border:1px solid #e5e7eb;padding:9px 12px;text-align:right;font-weight:bold;font-size:13px;">Grand Total</td>
            <td style="border:1px solid #e5e7eb;padding:9px 12px;text-align:right;font-weight:bold;font-size:14px;color:#f59e0b;">₹${fmtNum(grand)}</td>
          </tr>
        </table>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:720px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#f59e0b;padding:22px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;">DigiOptics</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">Purchase Order — Update Notification</div>
    </div>

    <div style="padding:18px 28px;background:#fffbeb;border-bottom:2px solid #f59e0b;">
      <p style="margin:0 0 6px;font-size:15px;">Dear <b>${fmt(vendorName)}</b>,</p>
      <p style="margin:0;font-size:14px;color:#555;">
        Please note that your purchase order has been <b style="color:#f59e0b;">updated</b>. The revised order details are attached below and in the Excel file.
      </p>
    </div>

    <div style="padding:20px 28px 8px;">
      <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;margin-bottom:24px;">
        <tr>
          <td style="padding:9px 14px;font-weight:bold;color:#f59e0b;font-size:12px;text-transform:uppercase;width:35%;">Purchase Order ID</td>
          <td style="padding:9px 14px;font-size:13px;font-weight:bold;">${fmt(purchaseOrderId)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:9px 14px;font-weight:bold;color:#f59e0b;font-size:12px;text-transform:uppercase;">Original Order Date</td>
          <td style="padding:9px 14px;font-size:13px;">${fmt(orderDate)}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;font-weight:bold;color:#f59e0b;font-size:12px;text-transform:uppercase;">Updated On</td>
          <td style="padding:9px 14px;font-size:13px;">${fmt(updatedAt)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:9px 14px;font-weight:bold;color:#f59e0b;font-size:12px;text-transform:uppercase;">Total Items</td>
          <td style="padding:9px 14px;font-size:13px;">${orders.reduce((s, o) => s + o.items.length, 0)}</td>
        </tr>
      </table>

      ${allOrderBlocks}
    </div>

    <div style="background:#f5f5f5;text-align:center;padding:14px 28px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics. This is a system-generated update notification. Please do not reply.
    </div>

  </div>
</body>
</html>`;
};

export default VendorOrderUpdatedTemplate;
