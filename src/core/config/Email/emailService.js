// import nodemailer from "nodemailer";
// import dotenv from 'dotenv';
// dotenv.config();

// export const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 587,
//   secure: false,
//   auth: {
//     user: process.env.VISUAL_EYES_USER_MAIL,
//     pass: process.env.VISUAL_EYES_TRANSPORTER_USER_PASSWORD,
//   },
//   connectionTimeout: 10000,
//   greetingTimeout: 10000,
//   socketTimeout: 10000,
//   tls: {
//     rejectUnauthorized: false,
//     minVersion: 'TLSv1.2'
//   }
// });

// async function sendEmail(to, subject, text, html) {
//   try {
//     const info = await transporter.sendMail({
//       from: process.env.VISUAL_EYES_USER_MAIL,
//       to,
//       subject,
//       text,
//       html,
//     });
//     console.log("Email sent successfully:", info.messageId);
//     return { success: true, messageId: info.messageId };
//   } catch (error) {
//     console.error("Error sending email:", error.message);
//     return { success: false, error: error.message };
//   }
// }

// export { sendEmail };


import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

async function sendEmail({ to, subject, html, attachments = [] }) {
  try {
    console.log("🚀 sendEmail triggered", to);

    const payload = {
      sender: {
        name: "DigiBySr",
        email: "webuildwebsites@digibysr.com",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    if (attachments.length > 0) {
      payload.attachment = attachments.map(file => ({
        name:    file.name,
        content: typeof file.content === "string"
          ? file.content
          : Buffer.from(file.content).toString("base64"),
      }));
    }

    const response = await axios.post(
      process.env.BREVO_SMTP_API_URL,
      payload,
      {
        headers: {
          "api-key":      process.env.BREVO_SMTP_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Email sent successfully:", response.data);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error.response?.data || error.message);
    return { success: false };
  }
}

export { sendEmail };