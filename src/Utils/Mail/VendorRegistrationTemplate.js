const VendorRegistrationTemplate = ({ vendorName, firmName, mobile, email }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Vendor Registration — DigiOptics</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:620px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#e8710a;padding:22px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;letter-spacing:0.5px;">DigiOptics</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">Vendor Registration Confirmation</div>
    </div>

    <div style="padding:28px;background:#fff8f3;border-bottom:2px solid #e8710a;">
      <p style="margin:0 0 6px;font-size:15px;">Dear <b>${vendorName}</b>,</p>
      <p style="margin:0;font-size:14px;color:#555;">
        You have been successfully registered as a vendor on <b>DigiOptics Wholesale</b>. We're excited to have you on board!
      </p>
    </div>

    <div style="padding:28px;">
      <p style="font-size:14px;color:#333;margin:0 0 16px;">Here are your registered details:</p>

      <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border:1px solid #e5e7eb;border-radius:6px;">
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;width:35%;">Vendor Name</td>
          <td style="padding:10px 14px;font-size:13px;">${vendorName}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;">Firm Name</td>
          <td style="padding:10px 14px;font-size:13px;">${firmName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;">Mobile</td>
          <td style="padding:10px 14px;font-size:13px;">${mobile}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-weight:bold;color:#e8710a;font-size:12px;text-transform:uppercase;">Email</td>
          <td style="padding:10px 14px;font-size:13px;">${email}</td>
        </tr>
      </table>

      <p style="margin:24px 0 0;font-size:13px;color:#777;">
        Our team will reach out to you shortly regarding upcoming orders and collaboration. If you have any questions, feel free to reply to this email.
      </p>
    </div>

    <div style="background:#f5f5f5;text-align:center;padding:16px 28px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics. This is a system-generated email. Please do not reply directly.
    </div>

  </div>
</body>
</html>`;

export default VendorRegistrationTemplate;
