import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN    = process.env.ULTRAMSG_TOKEN;

const formatPhone = (mobile) => {
  const cleaned = String(mobile).replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
};

export const sendWhatsAppMessage = async ({ to, message }) => {
  try {
    if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN) {
      console.warn("WhatsApp not configured — ULTRAMSG_INSTANCE_ID or ULTRAMSG_TOKEN missing");
      return { success: false };
    }

    const phone = formatPhone(to);

    const response = await axios.post(
      `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`,
      new URLSearchParams({
        token:   ULTRAMSG_TOKEN,
        to:      phone,
        body:    message,
        priority: "1",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log(`WhatsApp sent to ${phone}:`, response.data);
    return { success: true };
  } catch (error) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    return { success: false };
  }
};

export const vendorRegistrationWhatsApp = (vendor) =>
  `Hello ${vendor.name} 👋,

You have been successfully registered as a vendor on *DigiOptics Wholesale*.

*Your Details:*
• Firm Name: ${vendor.firm}
• Mobile: ${vendor.mobile}
• Email: ${vendor.email}

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
