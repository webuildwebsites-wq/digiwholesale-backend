const VendorProposalTemplate = ({ vendorName, proposalNumber, proposalDate, product, requiredQty, requiredByDate, description, quotationUrl }) => {
  const fmt = (v) => (v !== undefined && v !== null && v !== "" ? v : "-");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Purchase Proposal — ${proposalNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:660px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#1e40af;padding:22px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;letter-spacing:0.5px;">DigiOptics Wholesale</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">Purchase Proposal / RFQ</div>
    </div>

    <div style="padding:24px 28px;background:#eff6ff;border-bottom:2px solid #1e40af;">
      <p style="margin:0 0 6px;font-size:15px;">Dear <b>${fmt(vendorName)}</b>,</p>
      <p style="margin:0;font-size:14px;color:#555;">
        We would like to request a quotation for the following product. Kindly review the details and submit your best price and availability at the earliest.
      </p>
    </div>

    <div style="padding:24px 28px;">

      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;background:#f9f9f9;border:1px solid #e5e7eb;border-radius:6px;">
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#1e40af;font-size:12px;text-transform:uppercase;white-space:nowrap;width:40%;">Proposal No.</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(proposalNumber)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#1e40af;font-size:12px;text-transform:uppercase;">Date</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(proposalDate)}</td>
        </tr>
        ${requiredByDate ? `
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#1e40af;font-size:12px;text-transform:uppercase;">Required By</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(requiredByDate)}</td>
        </tr>` : ""}
      </table>

      <div style="font-size:15px;font-weight:700;color:#1e40af;margin-bottom:12px;border-left:4px solid #1e40af;padding-left:10px;">
        Product Details
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e5e7eb;border-radius:6px;">
        <tr style="background:#f9f9f9;">
          <td style="padding:10px 14px;font-weight:bold;color:#374151;font-size:12px;text-transform:uppercase;width:40%;">Product Name</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(product.productName)}</td>
        </tr>
        ${product.productCode ? `
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#374151;font-size:12px;text-transform:uppercase;">Product Code</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(product.productCode)}</td>
        </tr>` : ""}
        ${product.category ? `
        <tr style="background:#f9f9f9;">
          <td style="padding:10px 14px;font-weight:bold;color:#374151;font-size:12px;text-transform:uppercase;">Category</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(product.category)}</td>
        </tr>` : ""}
        ${product.brand ? `
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#374151;font-size:12px;text-transform:uppercase;">Brand</td>
          <td style="padding:10px 14px;font-size:14px;">${fmt(product.brand)}</td>
        </tr>` : ""}
        <tr style="background:#f9f9f9;">
          <td style="padding:10px 14px;font-weight:bold;color:#374151;font-size:12px;text-transform:uppercase;">Required Quantity</td>
          <td style="padding:10px 14px;font-size:15px;font-weight:bold;color:#1e40af;">${fmt(requiredQty)} ${fmt(product.unit)}</td>
        </tr>
      </table>

      ${description ? `
      <div style="margin-bottom:22px;padding:14px;background:#f9fafb;border-left:4px solid #6b7280;border-radius:4px;">
        <div style="font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Additional Requirements</div>
        <div style="font-size:14px;color:#374151;">${fmt(description)}</div>
      </div>` : ""}

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:bold;color:#1e40af;margin-bottom:8px;">Please provide your quotation including:</div>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;line-height:2;">
          <li>Unit price per ${fmt(product.unit)}</li>
          <li>Available quantity</li>
          <li>GST percentage and HSN/SAC code</li>
          <li>Expected delivery days</li>
          <li>Delivery terms and any other charges</li>
        </ul>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0;">
        Please reply to this email with your quotation or contact us directly. We look forward to your response.
      </p>

    </div>

    <div style="background:#f5f5f5;text-align:center;padding:16px 28px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics Wholesale. This is a system-generated proposal request.
    </div>

  </div>
</body>
</html>`;
};

export default VendorProposalTemplate;
