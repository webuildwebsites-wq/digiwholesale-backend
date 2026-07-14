const ResetPasswordTemplate = (name, resetUrl, expiryMinutes = 30) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #eeeeee; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
    .header { background-color: #1e40af; padding: 22px; text-align: center; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 32px; color: #333333; background-color: #f9f9f9; line-height: 1.7; font-size: 15px; }
    .content p { margin: 0 0 18px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { background-color: #1e40af; color: #ffffff; padding: 13px 32px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; }
    .note { color: #6b6b6b; font-size: 13px; margin-top: 15px; }
    .link-box { background-color: #eff6ff; border: 1px dashed #1e40af; border-radius: 6px; padding: 12px 16px; word-break: break-all; font-size: 13px; color: #555; margin: 16px 0; }
    .footer { background-color: #1e40af; text-align: center; padding: 16px; font-size: 12px; color: #ffffff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">DigiWholesale</div>
    <div class="content">
      <p>Hi <strong>${name}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to set a new password:</p>
      <div class="btn-wrap">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>
      <p class="note">This link will expire in <strong>${expiryMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
      <p class="note">If the button doesn't work, copy and paste this link into your browser:</p>
      <div class="link-box">${resetUrl}</div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} DigiWholesale — DigiBysr Technologies Pvt. Ltd.<br />All Rights Reserved.
    </div>
  </div>
</body>
</html>
  `;
};

export default ResetPasswordTemplate;
