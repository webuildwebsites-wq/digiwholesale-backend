import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const getWhatsAppConfig = () => {
    const baseUrl = (process.env.WHATSAPP_BASE_URL || "").replace(/\/+$/, "");
    const deviceToken = process.env.WHATSAPP_DEVICE_TOKEN || "";
    const jwtToken = process.env.WHATSAPP_JWT_TOKEN || "";
    const defaultPhone = process.env.WHATSAPP_DEFAULT_PHONE || "";

    return {
        baseUrl,
        deviceToken,
        jwtToken,
        defaultPhone,
        sendUrl: `${baseUrl}/devices/${deviceToken}/send`,
        sendMediaUrl: `${baseUrl}/devices/${deviceToken}/send-media`,
    };
};

export const sendWhatsAppOTP = async ({ phone, otp }) => {
    try {
        const { baseUrl, deviceToken, jwtToken, defaultPhone, sendUrl } = getWhatsAppConfig();
        const number = phone || defaultPhone;

        if (!baseUrl || !deviceToken) {
            console.error("sendWhatsAppOTP Error: WHATSAPP_BASE_URL or WHATSAPP_DEVICE_TOKEN missing from .env");
            return { success: false, reason: "CONFIG_MISSING" };
        }

        const response = await axios.post(
            sendUrl,
            { number, message: otp },
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(jwtToken && { Authorization: `Bearer ${jwtToken}` }),
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
        const { baseUrl, deviceToken, jwtToken, defaultPhone, sendMediaUrl } = getWhatsAppConfig();
        const number = phone || defaultPhone;

        if (!baseUrl || !deviceToken) {
            console.error("sendWhatsAppMedia Error: WHATSAPP_BASE_URL or WHATSAPP_DEVICE_TOKEN missing from .env");
            return { success: false, reason: "CONFIG_MISSING" };
        }

        console.log("sendWhatsAppMedia — number:", number, "| file:", fileName, "| endpoint:", sendMediaUrl);

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

        const response = await axios.post(sendMediaUrl, form, {
            headers: {
                ...form.getHeaders(),
                ...(jwtToken && { Authorization: `Bearer ${jwtToken}` }),
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
