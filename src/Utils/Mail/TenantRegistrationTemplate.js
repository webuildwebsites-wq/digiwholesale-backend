/**
 * TenantRegistrationTemplate
 * Sent to the newly registered wholesaler/tenant after successful registration.
 * Includes login credentials (email, password, tenantId), store info, plan, and expiry.
 */
const TenantRegistrationTemplate = ({
    ownerName,
    storeName,
    tenantId,
    email,
    password,
    mobile,
    planType,
    expiryDate,
}) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://digiwholesale-frontend.digibysr.in";
    const expiry = expiryDate ? new Date(expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to DigiWholesale — Account Created</title>
  <style>
    body { margin:0; padding:0; background:#f3f4f6; font-family:'Segoe UI',Roboto,Arial,sans-serif; }
    .wrap { max-width:620px; margin:36px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); border:1px solid #e2e8f0; }
    .header { background:linear-gradient(135deg,#1F618D 0%,#2980b9 100%); padding:24px 28px; color:#fff; }
    .header h1 { margin:0; font-size:22px; font-weight:700; letter-spacing:0.4px; }
    .header p { margin:4px 0 0; font-size:13px; opacity:0.88; }
    .hero { background:#f0f9ff; padding:20px 28px; border-bottom:2px solid #2980b9; }
    .hero p { margin:0; font-size:15px; color:#1e3a5f; }
    .body { padding:26px 28px; }
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase; color:#2980b9; letter-spacing:0.8px; margin:0 0 10px; }
    table.info { width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:22px; }
    table.info tr:nth-child(even) { background:#f9fafb; }
    table.info td { padding:10px 14px; font-size:13px; color:#333; vertical-align:top; }
    table.info td.label { font-weight:700; color:#1F618D; font-size:11px; text-transform:uppercase; width:36%; }
    .cred-box { background:#f0fdf4; border:1.5px dashed #16a34a; border-radius:8px; padding:16px 20px; margin:0 0 22px; }
    .cred-box p { margin:0 0 8px; font-size:14px; color:#0f172a; }
    .cred-box p:last-child { margin:0; }
    .cred-box strong { color:#15803d; display:inline-block; width:100px; }
    .cred-box .warn { font-size:12px; color:#92400e; background:#fef3c7; border-radius:4px; padding:6px 10px; margin-top:12px; }
    .btn-wrap { text-align:center; margin:20px 0 6px; }
    .btn { background:#2980b9; color:#fff; padding:13px 32px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px; display:inline-block; box-shadow:0 4px 12px rgba(41,128,185,0.25); }
    .note { font-size:13px; color:#64748b; margin:18px 0 0; line-height:1.6; }
    .footer { background:#0f172a; text-align:center; padding:16px 28px; font-size:12px; color:#94a3b8; }
  </style>
</head>
<body>
  <div class="wrap">

    <div class="header">
      <h1>DigiWholesale</h1>
      <p>Wholesaler Account Registration Confirmation</p>
    </div>

    <div class="hero">
      <p>Dear <b>${ownerName}</b>, welcome aboard! 🎉<br/>
      Your wholesaler account on <b>DigiWholesale</b> has been successfully created and is ready to use.</p>
    </div>

    <div class="body">

      <!-- Store & Account Info -->
      <p class="section-title">Account Details</p>
      <table class="info">
        <tr>
          <td class="label">Store Name</td>
          <td>${storeName}</td>
        </tr>
        <tr>
          <td class="label">Tenant ID</td>
          <td><b style="font-family:monospace;color:#1F618D;">${tenantId}</b></td>
        </tr>
        <tr>
          <td class="label">Owner Name</td>
          <td>${ownerName}</td>
        </tr>
        <tr>
          <td class="label">Mobile</td>
          <td>${mobile}</td>
        </tr>
        <tr>
          <td class="label">Email</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td class="label">Plan</td>
          <td><b>${planType}</b></td>
        </tr>
        <tr>
          <td class="label">Valid Until</td>
          <td>${expiry}</td>
        </tr>
      </table>

      <!-- Login Credentials -->
      <p class="section-title">Your Login Credentials</p>
      <div class="cred-box">
        <p><strong>Email / ID:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p><strong>Tenant ID:</strong> ${tenantId}</p>
        <div class="warn">⚠️ Please log in and change your password immediately for security.</div>
      </div>

      <div class="btn-wrap">
        <a href="${frontendUrl}" class="btn">Login to DigiWholesale →</a>
      </div>

      <p class="note">
        If you have any questions or need support, please contact our team. Keep your Tenant ID safe — it uniquely identifies your business on our platform.
      </p>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} DigiWholesale — DigiBysr Technologies Pvt. Ltd. All Rights Reserved.<br/>
      This is a system-generated email. Please do not reply directly.
    </div>

  </div>
</body>
</html>`;
};

export default TenantRegistrationTemplate;
