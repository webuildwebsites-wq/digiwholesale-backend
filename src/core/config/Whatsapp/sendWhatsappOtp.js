import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
dotenv.config();

const WHATSAPP_BASE_URL   = process.env.WHATSAPP_BASE_URL   || "https://digiwppconnect-backend.digibysr.in";
const WHATSAPP_DEVICE_TOKEN = process.env.WHATSAPP_DEVICE_TOKEN || "32200dde-249d-4ef9-ab9d-be7414120e12";

const DEFAULT_PHONE         = process.env.WHATSAPP_DEFAULT_PHONE || "917579440117";

const SEND_URL       = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send`;
const SEND_MEDIA_URL = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send-media`;

export const sendWhatsAppOTP = async ({ phone, otp }) => {
    try {
        const number = phone || DEFAULT_PHONE;
        const response = await axios.post(
            SEND_URL,
            { number, message: otp },
            { headers: { "Content-Type": "application/json" } }
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
            headers:          form.getHeaders(),
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
