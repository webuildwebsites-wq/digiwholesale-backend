import dotenv from 'dotenv'
import axios from 'axios';
dotenv.config()

export const sendWhatsAppOTP = async ({ phone, otp }) => {
  // try {
  //   const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  //   const payload = {
  //     messaging_product: 'whatsapp',
  //     to: phone,
  //     type: 'template',
  //     template: {
  //       name: 'visualeyes_otp',
  //       language: { code: 'en' },
  //       components: [
  //         {
  //           type: 'body',
  //           parameters: [
  //             {
  //               type: 'text',
  //               text: otp
  //             }
  //           ]
  //         }
  //       ]
  //     }
  //   };

  //   const response = await axios.post(url, payload, {
  //     headers: {
  //       Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });

  //   console.log("response : ", response);

  //   return {
  //     success: true,
  //     messageId: response.data.messages[0].id
  //   };

  // } catch (error) {
  //   console.error('WhatsApp OTP Error:', error.response?.data || error.message);
  //   return error.message;
  // }
};
