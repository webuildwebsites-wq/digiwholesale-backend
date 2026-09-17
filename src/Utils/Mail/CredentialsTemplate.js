const CredentialsTemplate = (username, businessEmail, customerpassword) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://digiwholesale-frontend.digibysr.in";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Account Credentials</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1F618D 0%, #1e40af 100%); padding: 24px; text-align: center; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; color: #334155; line-height: 1.7; font-size: 15px; }
    .content p { margin: 0 0 18px; }
    .credentials-box { margin: 24px auto; background-color: #f0f9ff; border: 1.5px dashed #2980B9; padding: 18px; border-radius: 8px; font-size: 15px; color: #0f172a; }
    .credentials-box strong { display: inline-block; width: 90px; color: #1F618D; }
    .note { color: #64748b; font-size: 13px; margin-top: 15px; }
    .btn { background-color: #2980B9; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(41, 128, 185, 0.25); }
    .footer { background-color: #0f172a; text-align: center; padding: 18px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">DigiWholesale</div>
    <div class="content">
      <p>Hey <strong>${username}</strong>,</p>
      <p>Your account has been successfully created 🎉<br/>Below are your login credentials:</p>
      <div class="credentials-box">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${businessEmail}</p>
        <p style="margin: 0;"><strong>Password:</strong> ${customerpassword}</p>
      </div>
      <p>Please use the link below to log in and accept the Terms &amp; Conditions of DigiWholesale to activate your account:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${frontendUrl}/customer-login" class="btn">Login to DigiWholesale</a>
      </div>
      <p class="note">For security reasons, please log in and change your password immediately after accepting the Terms &amp; Conditions.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} DigiWholesale — DigiBysr Technologies Pvt. Ltd.<br />All Rights Reserved.
    </div>
  </div>
</body>
</html>`;
};

export default CredentialsTemplate;
