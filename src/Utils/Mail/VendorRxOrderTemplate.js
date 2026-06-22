const VendorRxOrderTemplate = ({ vendorName, orderNumber, orderDate, customer, shipTo, items }) => {
  const fmt = (v) => (v !== undefined && v !== null && v !== "" ? v : "-");

  const itemRows = items.map((item, idx) => {
    const rx = item.rx || {};
    const powers = rx.powers || [];
    const rPower = powers.find((p) => p.side === "R") || {};
    const lPower = powers.find((p) => p.side === "L") || {};

    const powerRow = (label, p) => `
      <tr>
        <td style="padding:4px 8px;font-weight:bold;background:#f5f5f5;white-space:nowrap;">${label}</td>
        <td style="padding:4px 8px;">${fmt(p.sph)}</td>
        <td style="padding:4px 8px;">${fmt(p.cyl)}</td>
        <td style="padding:4px 8px;">${fmt(p.axis)}</td>
        <td style="padding:4px 8px;">${fmt(p.add)}</td>
        <td style="padding:4px 8px;">${fmt(p.dnp)}</td>
        <td style="padding:4px 8px;">${fmt(p.ht)}</td>
      </tr>`;

    const prism = rx.prism || {};
    const centration = rx.centration || {};

    return `
    <div style="border:1px solid #ddd;border-radius:6px;margin-bottom:20px;overflow:hidden;">
      <div style="background:#e8710a;color:#fff;padding:8px 14px;font-weight:bold;font-size:14px;">
        Item ${idx + 1}: ${fmt(item.itemName)}
      </div>
      <div style="padding:12px 14px;">

        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td style="width:50%;vertical-align:top;padding:4px 0;">
              <b>Qty:</b> ${fmt(item.qty)}<br/>
              <b>Price:</b> ₹${fmt(item.price)}<br/>
              <b>Category:</b> ${fmt(item.category)}<br/>
              <b>HSN:</b> ${fmt(item.hsnSac)}
            </td>
            <td style="width:50%;vertical-align:top;padding:4px 0;">
              <b>Coating:</b> ${fmt(rx.coating?.name)}<br/>
              <b>Tint:</b> ${fmt(rx.tint?.name)} ${rx.tintValue ? `(${rx.tintValue})` : ""}<br/>
              <b>Treatment:</b> ${fmt(rx.treatment?.name)}<br/>
              <b>Index:</b> ${fmt(item.index)}
            </td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;margin-bottom:10px;">
          <thead>
            <tr style="background:#333;color:#fff;">
              <th style="padding:6px 8px;text-align:left;">Side</th>
              <th style="padding:6px 8px;">SPH</th>
              <th style="padding:6px 8px;">CYL</th>
              <th style="padding:6px 8px;">AXIS</th>
              <th style="padding:6px 8px;">ADD</th>
              <th style="padding:6px 8px;">DNP</th>
              <th style="padding:6px 8px;">HT</th>
            </tr>
          </thead>
          <tbody>
            ${powerRow("R (Right)", rPower)}
            ${powerRow("L (Left)", lPower)}
          </tbody>
        </table>

        ${(prism.base || prism.value) ? `
        <div style="margin-bottom:8px;">
          <b>Prism:</b> Base: ${fmt(prism.base)}, Value: ${fmt(prism.value)}
        </div>` : ""}

        ${(centration.monoR || centration.monoL || centration.binocular) ? `
        <div style="margin-bottom:8px;">
          <b>Centration:</b>
          Mono R: ${fmt(centration.monoR)},
          Mono L: ${fmt(centration.monoL)},
          Binocular: ${fmt(centration.binocular)}
        </div>` : ""}

        ${rx.fitting ? `
        <div style="margin-bottom:8px;">
          <b>Fitting:</b> ${fmt(rx.fitting?.name || rx.fitting)}
        </div>` : ""}

        ${rx.lab?.name ? `
        <div style="margin-bottom:8px;">
          <b>Lab:</b> ${fmt(rx.lab.name)}
        </div>` : ""}

        ${rx.brand?.name ? `
        <div style="margin-bottom:8px;">
          <b>Brand:</b> ${fmt(rx.brand.name)}
        </div>` : ""}

        ${item.remarks ? `
        <div style="margin-bottom:8px;">
          <b>Remarks:</b> ${fmt(item.remarks)}
        </div>` : ""}

      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>RX Order — ${orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#eeeeee;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#e8710a;padding:20px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;letter-spacing:0.5px;">DigiOptics</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">RX Manufacturing Order</div>
    </div>

    <div style="padding:24px 28px;background:#fff8f3;border-bottom:2px solid #e8710a;">
      <p style="margin:0 0 6px;font-size:15px;">Dear <b>${fmt(vendorName)}</b>,</p>
      <p style="margin:0;font-size:14px;color:#555;">
        Please find below the RX order details assigned to you. Kindly process these items at your earliest convenience.
      </p>
    </div>

    <div style="padding:24px 28px;">

      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;">
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:13px;text-transform:uppercase;white-space:nowrap;width:40%;">Order Number</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(orderNumber)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:13px;text-transform:uppercase;">Order Date</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(orderDate)}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:13px;text-transform:uppercase;">Customer</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(customer.name)}</td>
        </tr>
        ${customer.phone ? `
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:13px;text-transform:uppercase;">Customer Phone</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(customer.phone)}</td>
        </tr>` : ""}
        ${shipTo ? `
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:13px;text-transform:uppercase;">Ship To</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(shipTo)}</td>
        </tr>` : ""}
      </table>

      <div style="font-size:16px;font-weight:700;color:#333;margin-bottom:14px;border-left:4px solid #e8710a;padding-left:10px;">
        RX Items (${items.length})
      </div>

      ${itemRows}

    </div>

    <div style="background:#f5f5f5;text-align:center;padding:16px 28px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics. This is a system-generated order notification.
    </div>

  </div>
</body>
</html>`;
};

export default VendorRxOrderTemplate;
