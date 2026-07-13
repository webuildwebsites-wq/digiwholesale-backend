import BulkOrder from "../../../models/order/BulkOrder.js";
import Customer from "../../../models/Auth/Customer.js";
import generatePDF from "../pdfService.js";
import { generateDeliveryChallanHTML, generatedorderInvoice } from "../../../Utils/templates/deliveryChallanTemplate.js";
import { sendEmail } from "../../config/Email/emailService.js";
import { sendWhatsAppOTP, sendWhatsAppMedia } from "../../config/Whatsapp/sendWhatsappOtp.js";

const buildChallanData = (bulkOrder, customer) => ({
    billNumber:     bulkOrder.orders[0]?.orderNumber,
    orderDate:      bulkOrder.createdAt,
    deliveryDate:   bulkOrder.createdAt,
    companyName:    process.env.COMPANY_NAME    || "DigiOptics",
    companyAddress: process.env.COMPANY_ADDRESS || "WeWork Eldeco Centre, New Delhi",
    companyEmail:   process.env.COMPANY_EMAIL   || "sid@digibysr.com",
    companyPhone:   process.env.COMPANY_PHONE   || "+91 9650560526",
    companyGstin:   process.env.COMPANY_GSTIN   || "GST9876543210",
    customerName:   bulkOrder.customer.customerName,
    customerAddress:bulkOrder.customer.customerShipToBranchName || customer?.billToAddress?.address || "",
    customerPhone:  customer?.mobileNo1 || "",
    orders:         bulkOrder.orders,
});

const buildInvoiceData = (bulkOrder, customer) => {
    const billTo   = customer?.billToAddress || {};
    const shipToAddress = bulkOrder.customer.customerShipToId
        ? customer?.customerShipToDetails?.find(s => s._id.toString() === bulkOrder.customer.customerShipToId.toString())
        : null;
    const shipTo = shipToAddress || billTo;

    const allItems = bulkOrder.orders.flatMap(order =>
        order.items.map(item => {
            const price    = item.price || 0;
            const qty      = item.qty   || 0;
            const value    = price * qty;
            const discount = item.discountPercent || 0;
            const netValue = discount ? value * (1 - discount / 100) : value;
            return {
                orderNo:             order.orderNumber || "",
                dcNo:                "",
                orderDate:           new Date(order.createdAt || bulkOrder.createdAt).toLocaleDateString("en-IN"),
                referenceNo:         item.code || "",
                materialDescription: item.itemName || "",
                hsn:                 item.hsnSac || "",
                quantity:            qty,
                unitRate:            price,
                value,
                discount,
                netValue,
            };
        })
    );

    const totalQty       = allItems.reduce((s, i) => s + Number(i.quantity), 0);
    const grossAmount    = allItems.reduce((s, i) => s + Number(i.value), 0);
    const discountAmount = allItems.reduce((s, i) => s + (Number(i.value) - Number(i.netValue)), 0);
    const taxableAmount  = grossAmount - discountAmount;
    const cgstAmount     = bulkOrder.orders.reduce((s, o) => s + (parseFloat(o.cgst) || 0), 0);
    const sgstAmount     = bulkOrder.orders.reduce((s, o) => s + (parseFloat(o.sgst) || 0), 0);
    const grandTotal     = taxableAmount + cgstAmount + sgstAmount;

    return {
        invoiceNo:    bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString(),
        invoiceDate:  new Date(bulkOrder.createdAt).toLocaleDateString("en-IN"),
        irnNo:        "",
        placeOfSupply: billTo.state || "",
        company: {
            name:         "DigiOptics",
            addressLine1: "WeWork Eldeco Centre, Block A, Shivalik Colony",
            addressLine2: "Malviya Nagar, New Delhi, Delhi 110017",
            city:         "",
            gstin:        process.env.COMPANY_GSTIN || "GST9876543210",
            stateCode:    "",
        },
        billTo: {
            name:          bulkOrder.customer.customerName,
            branchName:    billTo.branchName            || "",
            contactName:   billTo.customerContactName   || "",
            contactNumber: billTo.customerContactNumber || "",
            address:       billTo.address               || "",
            state:         billTo.state                 || "",
            city:          billTo.city                  || "",
            pincode:       billTo.zipCode               || "",
            gstin:         customer?.gstNumber          || "",
        },
        shipTo: {
            name:          bulkOrder.customer.customerShipToBranchName || bulkOrder.customer.customerName,
            branchName:    shipTo.branchName            || "",
            contactName:   shipTo.customerContactName   || "",
            contactNumber: shipTo.customerContactNumber || "",
            address:       shipTo.address               || "",
            state:         shipTo.state                 || "",
            city:          shipTo.city                  || "",
            pincode:       shipTo.zipCode               || "",
        },
        items:         allItems,
        totalQty,
        grossAmount:   grossAmount.toFixed(2),
        discountAmount:discountAmount.toFixed(2),
        taxableAmount: taxableAmount.toFixed(2),
        cgstAmount,
        sgstAmount,
        igstAmount:    0,
        grandTotal:    grandTotal.toFixed(2),
    };
};

const sendChallanNotification = async ({ bulkOrder, customer, subject, emailSubject }) => {
    try {
        const challanHTML = generateDeliveryChallanHTML(buildChallanData(bulkOrder, customer));
        const pdfBuffer   = await generatePDF(challanHTML);
        const orderNumber = bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString();

        if (customer.businessEmail) {
            sendEmail({
                to:      customer.businessEmail,
                subject: emailSubject || `Delivery Challan — ${orderNumber}`,
                html:    `<p>Dear ${customer.ownerName || customer.shopName},</p><p>Please find your delivery challan attached.</p>`,
                attachments: [{
                    name:    `Challan-${orderNumber}.pdf`,
                    content: pdfBuffer.toString("base64"),
                }],
            }).catch(err => console.error("Challan email error:", err.message));
        }

        if (customer.mobileNo1) {
            sendWhatsAppMedia({
                phone:      `91${customer.mobileNo1}`,
                message:    `Dear ${customer.ownerName || customer.shopName}, please find your Delivery Challan for Order ${orderNumber} attached.`,
                fileBuffer: pdfBuffer,
                fileName:   `Challan-${orderNumber}.pdf`,
                mimeType:   "application/pdf",
            }).catch(err => console.error("Challan WhatsApp media error:", err.message));
        } else {
            console.log(`Challan WhatsApp skipped — no mobileNo1 for customer: ${customer._id}`);
        }
    } catch (err) {
        console.error("sendChallanNotification error:", err.message);
    }
};

const sendInvoiceNotification = async ({ bulkOrder, customer }) => {
    try {
        const invoiceData = buildInvoiceData(bulkOrder, customer);
        const invoiceHTML = generatedorderInvoice(invoiceData);
        const pdfBuffer   = await generatePDF(invoiceHTML);
        const orderNumber = bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString();

        if (customer.businessEmail) {
            sendEmail({
                to:      customer.businessEmail,
                subject: `Tax Invoice — ${orderNumber}`,
                html:    `<p>Dear ${customer.ownerName || customer.shopName},</p><p>Please find your invoice attached for Order ${orderNumber}.</p>`,
                attachments: [{
                    name:    `Invoice-${orderNumber}.pdf`,
                    content: pdfBuffer.toString("base64"),
                }],
            }).catch(err => console.error("Invoice email error:", err.message));
        }

        if (customer.mobileNo1) {
            sendWhatsAppMedia({
                phone:      `91${customer.mobileNo1}`,
                message:    `Dear ${customer.ownerName || customer.shopName}, please find your Invoice for Order ${orderNumber} attached.`,
                fileBuffer: pdfBuffer,
                fileName:   `Invoice-${orderNumber}.pdf`,
                mimeType:   "application/pdf",
            }).catch(err => console.error("Invoice WhatsApp media error:", err.message));
        } else {
            console.log(`Invoice WhatsApp skipped — no mobileNo1 for customer: ${customer._id}`);
        }
    } catch (err) {
        console.error("sendInvoiceNotification error:", err.message);
    }
};

export const handleOrderBillingNotification = async ({ bulkOrder, customer }) => {
    try {
        const billingMode  = customer.billingMode;
        const billingCycle = customer.billingCycle;

        if (billingMode === "Direct") {
            await sendInvoiceNotification({ bulkOrder, customer });
            return;
        }

        if (billingMode === "DC") {
            await sendChallanNotification({
                bulkOrder,
                customer,
                emailSubject: `Delivery Challan — ${bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString()}`,
            });
            return;
        }

    } catch (err) {
        console.error("handleOrderBillingNotification error:", err.message);
    }
};

export const sendDCBillingCycleChallan = async (customerId) => {
    try {
        const customer = await Customer.findById(customerId).lean();
        if (!customer || customer.billingMode !== "DC") return;

        const billingCycle = customer.billingCycle;

        const now      = new Date();
        let fromDate   = new Date();

        if (billingCycle === "7_days") {
            fromDate.setDate(now.getDate() - 7);
        } else if (billingCycle === "15_days") {
            fromDate.setDate(now.getDate() - 15);
        } else if (billingCycle === "end_of_month") {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
            fromDate.setDate(now.getDate() - 30);
        }

        const orders = await BulkOrder.find({
            "customer.customerId": customerId,
            createdAt: { $gte: fromDate, $lte: now },
        }).lean();

        if (!orders || orders.length === 0) {
            console.log(`No orders found for customer ${customerId} in billing cycle`);
            return;
        }

        const periodLabel = billingCycle === "7_days"       ? "7 Days"
                          : billingCycle === "15_days"      ? "15 Days"
                          : billingCycle === "end_of_month" ? "Monthly"
                          : "30 Days";

        const combinedOrders = orders.flatMap(bo => bo.orders);

        const fakeBulkOrder = {
            _id:      orders[0]._id,
            customer: orders[0].customer,
            orders:   combinedOrders,
            createdAt:now,
        };

        await sendChallanNotification({
            bulkOrder:    fakeBulkOrder,
            customer,
            emailSubject: `Delivery Challan — ${periodLabel} Summary (${fromDate.toLocaleDateString("en-IN")} to ${now.toLocaleDateString("en-IN")})`,
        });

    } catch (err) {
        console.error("sendDCBillingCycleChallan error:", err.message);
    }
};
