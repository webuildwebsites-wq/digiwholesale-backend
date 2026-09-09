import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
dotenv.config();

const WHATSAPP_BASE_URL   = process.env.WHATSAPP_BASE_URL   || "https://digiwppconnect-backend.digibysr.in";
const WHATSAPP_DEVICE_TOKEN = process.env.WHATSAPP_DEVICE_TOKEN || "cc759a15-f9e5-4f46-8604-6c26ed9ecdcd";
const WHATSAPP_JWT_TOKEN   = process.env.WHATSAPP_JWT_TOKEN   || "wpp_62a1fd8d656a8511c18d0eef3a42646fd0d2119285135c9d32619d6ab1aaa00f798fdc7aa485bf16e38341f0780b8d83";

const DEFAULT_PHONE         = process.env.WHATSAPP_DEFAULT_PHONE || "918368942780";

const SEND_URL       = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send`;
const SEND_MEDIA_URL = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send-media`;

export const sendWhatsAppOTP = async ({ phone, otp }) => {
    try {
        const number = phone || DEFAULT_PHONE;
        const response = await axios.post(
            SEND_URL,
            { number, message: otp },
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(WHATSAPP_JWT_TOKEN && { Authorization: `Bearer ${WHATSAPP_JWT_TOKEN}` }),
                },
            }
        );
        console.log("WhatsApp message sent:", response.data);
        return { success: true, result: response.data?.result };
    } catch (error) {
        console.error("WhatsApp OTP Error:", error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
};

export const sendWhatsAppMedia = async ({ phone, message, fileBuffer, fileName, mimeType }) => {
    try {
        const number = phone || DEFAULT_PHONE;
        console.log("sendWhatsAppMedia — number:", number, "| file:", fileName, "| endpoint:", SEND_MEDIA_URL);

        const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
        const name   = fileName || "document.pdf";
        const mime   = mimeType || "application/pdf";

        const form = new FormData();
        form.append("number",  number);
        form.append("message", message || "");
        form.append("media",   buffer, {
            filename:    name,
            contentType: mime,
            knownLength: buffer.length,
        });

        const response = await axios.post(SEND_MEDIA_URL, form, {
            headers: {
                ...form.getHeaders(),
                ...(WHATSAPP_JWT_TOKEN && { Authorization: `Bearer ${WHATSAPP_JWT_TOKEN}` }),
            },
            maxBodyLength:    Infinity,
            maxContentLength: Infinity,
        });

        console.log("WhatsApp media sent:", response.data);
        return { success: true, result: response.data?.result };
    } catch (error) {
        console.error("WhatsApp Media Error:", error.response?.status, JSON.stringify(error.response?.data || error.message));
        return { success: false, error: error.response?.data || error.message };
    }
};
