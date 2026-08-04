import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const WHATSAPP_BASE_URL    = process.env.WHATSAPP_BASE_URL    || "https://digiwppconnect-backend.digibysr.in";
const WHATSAPP_DEVICE_TOKEN = process.env.WHATSAPP_DEVICE_TOKEN || "29a959f6-e5ee-46e5-80b7-603d8dc92efd";



const SEND_URL = `${WHATSAPP_BASE_URL}/devices/${WHATSAPP_DEVICE_TOKEN}/send`;

const formatPhone = (mobile) => {
  const cleaned = String(mobile).replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
};

export const sendWhatsAppMessage = async ({ to, message }) => {
  try {
    const number = formatPhone(to);

    const response = await axios.post(
      SEND_URL,
      { number, message },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log(`WhatsApp sent to ${number}:`, response.data);
    return { success: true, result: response.data?.result };
  } catch (error) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

export const vendorRegistrationWhatsApp = ({ name, firm, mobile, email }) =>
  `Hello ${name} 👋,

You have been successfully registered as a vendor on *DigiOptics Wholesale*.

*Your Details:*
• Firm Name: ${firm}
• Mobile: ${mobile}
• Email: ${email}

Our team will reach out to you shortly. For any queries, please contact us.

Thank you,
*DigiOptics Wholesale Team*`;

export const vendorNewOrderWhatsApp = ({ vendorName, purchaseOrderId, orderDate, totalOrders, totalItems }) =>
  `Hello ${vendorName} 👋,

A *New Purchase Order* has been placed with you on *DigiOptics Wholesale*.

*Order Details:*
• Purchase Order ID: ${purchaseOrderId}
• Order Date: ${orderDate}
• Total Sub-Orders: ${totalOrders}
• Total Items: ${totalItems}

Please check your email for the complete order details and Excel attachment.

Thank you,
*DigiOptics Wholesale Team*`;

export const vendorOrderUpdatedWhatsApp = ({ vendorName, purchaseOrderId, orderDate, updatedAt }) =>
  `Hello ${vendorName} 👋,

Your Purchase Order has been *Updated* on *DigiOptics Wholesale*.

*Order Details:*
• Purchase Order ID: ${purchaseOrderId}
• Original Order Date: ${orderDate}
• Updated On: ${updatedAt}

Please check your email for the updated order details and Excel attachment.

Thank you,
*DigiOptics Wholesale Team*`;
