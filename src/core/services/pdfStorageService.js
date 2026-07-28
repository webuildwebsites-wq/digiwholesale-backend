import { bucket } from "../config/bucket/gcs.js";
import BulkOrder from "../../models/order/BulkOrder.js";
import Customer from "../../models/Auth/Customer.js";
import generatePDF from "./pdfService.js";
import { generateDeliveryChallanHTML, generatedorderInvoice } from "../../Utils/templates/deliveryChallanTemplate.js";

const uploadPDFToGCS = (buffer, fileName) => {
    return new Promise((resolve, reject) => {
        const blob       = bucket.file(`pdfs/${fileName}`);
        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata:  { contentType: "application/pdf" },
        });
        blobStream.on("error", reject);
        blobStream.on("finish", () => {
            resolve(`https://storage.googleapis.com/${bucket.name}/pdfs/${fileName}`);
        });
        blobStream.end(buffer);
    });
};

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
    const billTo        = customer?.billToAddress || {};
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
                referenceNo:         item.code    || "",
                materialDescription: item.itemName || "",
                hsn:                 item.hsnSac  || "",
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
        invoiceNo:     bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString(),
        invoiceDate:   new Date(bulkOrder.createdAt).toLocaleDateString("en-IN"),
        irnNo:         "",
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
            branchName:    shipTo.branchName    || "",
            contactName:   shipTo.customerContactName   || "",
            contactNumber: shipTo.customerContactNumber || "",
            address:       shipTo.address       || "",
            state:         shipTo.state         || "",
            city:          shipTo.city          || "",
            pincode:       shipTo.zipCode       || "",
        },
        items:          allItems,
        totalQty,
        grossAmount:    grossAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxableAmount:  taxableAmount.toFixed(2),
        cgstAmount,
        sgstAmount,
        igstAmount:     0,
        grandTotal:     grandTotal.toFixed(2),
    };
};

export const generateAndStoreChallan = async (orderId, tenantId) => {
    try {
        const [bulkOrder, customerDoc] = await Promise.all([
            BulkOrder.findOne({ _id: orderId, tenantId }).lean(),
            BulkOrder.findOne({ _id: orderId, tenantId }).lean().then(bo =>
                bo ? Customer.findOne({ _id: bo.customer.customerId, tenantId }).lean() : null
            ),
        ]);

        if (!bulkOrder) throw new Error("BulkOrder not found");

        const customer   = customerDoc;
        const challanHTML = generateDeliveryChallanHTML(buildChallanData(bulkOrder, customer));
        const pdfBuffer  = await generatePDF(challanHTML);
        const fileName   = `challan-${bulkOrder.orders[0]?.orderNumber || orderId}-${Date.now()}.pdf`;
        const url        = await uploadPDFToGCS(pdfBuffer, fileName);

        await BulkOrder.findOneAndUpdate({ _id: orderId, tenantId }, {
            challanUrl:   url,
            challanGenAt: new Date(),
        });

        console.log(`[PDF] Challan stored: ${url}`);
        return { url, buffer: pdfBuffer };
    } catch (err) {
        console.error("[PDF] generateAndStoreChallan error:", err.message);
        throw err;
    }
};

export const generateAndStoreInvoice = async (orderId, tenantId) => {
    try {
        const bulkOrder = await BulkOrder.findOne({ _id: orderId, tenantId }).lean();
        if (!bulkOrder) throw new Error("BulkOrder not found");

        const customer   = await Customer.findOne({ _id: bulkOrder.customer.customerId, tenantId }).lean();
        const invoiceHTML = generatedorderInvoice(buildInvoiceData(bulkOrder, customer));
        const pdfBuffer  = await generatePDF(invoiceHTML);
        const fileName   = `invoice-${bulkOrder.orders[0]?.orderNumber || orderId}-${Date.now()}.pdf`;
        const url        = await uploadPDFToGCS(pdfBuffer, fileName);

        await BulkOrder.findOneAndUpdate({ _id: orderId, tenantId }, {
            invoiceUrl:   url,
            invoiceGenAt: new Date(),
        });

        console.log(`[PDF] Invoice stored: ${url}`);
        return { url, buffer: pdfBuffer };
    } catch (err) {
        console.error("[PDF] generateAndStoreInvoice error:", err.message);
        throw err;
    }
};

export const invalidatePDFs = async (orderId, tenantId) => {
    await BulkOrder.findOneAndUpdate({ _id: orderId, ...(tenantId ? { tenantId } : {}) }, {
        invoiceUrl:   null,
        challanUrl:   null,
        invoiceGenAt: null,
        challanGenAt: null,
    });
};
