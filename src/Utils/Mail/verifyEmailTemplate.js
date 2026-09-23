const VerificationEmail = (username, otp) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1F618D 0%, #1e40af 100%); padding: 24px; text-align: center; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; color: #334155; line-height: 1.7; font-size: 15px; }
    .content p { margin: 0 0 18px; }
    .otp-box { margin: 24px auto; text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #1F618D; background-color: #f0f9ff; border: 2px dashed #2980B9; padding: 16px 0; border-radius: 8px; width: 70%; }
    .note { color: #64748b; font-size: 13px; margin-top: 10px; }
    .footer { background-color: #0f172a; text-align: center; padding: 18px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">DigiWholesale</div>
    <div class="content">
      <p>Hey <strong>${username}</strong>,</p>
      <p>Welcome to <strong>DigiWholesale</strong> 👋<br/>Use the verification code below to confirm your account.</p>
      <div class="otp-box">${otp}</div>
      <p class="note">This code is valid for a limited time.<br/>If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} DigiWholesale — DigiBysr Technologies Pvt. Ltd.<br />All Rights Reserved.
    </div>
  </div>
</body>
</html>`;
};

export default VerificationEmail;
