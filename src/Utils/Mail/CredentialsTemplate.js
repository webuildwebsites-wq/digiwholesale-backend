const CredentialsTemplate = (username, businessEmail, customerpassword) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://digiwholesale-frontend.digibysr.in";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Account Credentials</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #eeeeee;
      font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
    }
    .header {
      background-color: #1e40af;
      padding: 22px;
      text-align: center;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 32px;
      color: #333333;
      background-color: #f9f9f9;
      line-height: 1.7;
      font-size: 15px;
    }
    .content p {
      margin: 0 0 18px;
    }
    .credentials-box {
      margin: 24px auto;
      background-color: #eff6ff;
      border: 2px dashed #1e40af;
      padding: 18px;
      border-radius: 8px;
      width: 85%;
      font-size: 15px;
    }
    .credentials-box strong {
      display: inline-block;
      width: 90px;
    }
    .note {
      color: #6b6b6b;
      font-size: 13px;
      margin-top: 15px;
    }
    .footer {
      background-color: #1e40af;
      text-align: center;
      padding: 16px;
      font-size: 12px;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      DigiWholesale
    </div>
    <div class="content">
      <p>Hey <strong>${username}</strong>,</p>
      <p>
        Your account has been successfully created 🎉<br/>
        Below are your login credentials:
      </p>
      <div class="credentials-box">
        <p><strong>Email:</strong> ${businessEmail}</p>
        <p><strong>Password:</strong> ${customerpassword}</p>
      </div>
      <p>
        Please use the link below to log in and accept the Terms &amp; Conditions of DigiWholesale to activate your account:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${frontendUrl}/customer-login"
           style="background-color: #1e40af; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">
          Login to DigiWholesale
        </a>
      </div>
      <p class="note">
        For security reasons, please log in and change your password immediately after accepting the Terms &amp; Conditions.
      </p>
      <p>
        If you did not request this account, please contact our support team immediately.
      </p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} DigiWholesale — DigiBysr Technologies Pvt. Ltd.<br />
      All Rights Reserved.
    </div>
  </div>
</body>
</html>
  `;
};

export default CredentialsTemplate;
