import { bucket } from "../config/bucket/gcs.js";
import BulkOrder from "../../models/order/BulkOrder.js";
import Customer from "../../models/Auth/Customer.js";
import Tenant from "../../models/Tenant/Tenant.model.js";
import Payment from "../../models/Accounting/Payment.model.js";
import generatePDF from "./pdfService.js";
import { generateDeliveryChallanHTML, generatedorderInvoice } from "../../Utils/templates/deliveryChallanTemplate.js";

const uploadPDFToGCS = async (buffer, fileName) => {
    try {
        if (!bucket || !process.env.GOOGLE_CLOUD_BUCKET_NAME) {
            return null;
        }
        return await new Promise((resolve) => {
            const blob       = bucket.file(`pdfs/${fileName}`);
            const blobStream = blob.createWriteStream({
                resumable: false,
                metadata:  { contentType: "application/pdf" },
            });
            blobStream.on("error", (err) => {
                console.warn("[PDF] GCS upload skipped (local dev/no credentials):", err.message);
                resolve(null);
            });
            blobStream.on("finish", () => {
                resolve(`https://storage.googleapis.com/${bucket.name}/pdfs/${fileName}`);
            });
            blobStream.end(buffer);
        });
    } catch (err) {
        console.warn("[PDF] GCS upload skipped:", err.message);
        return null;
    }
};

const buildChallanData = (bulkOrder, customer, tenantDoc = null, orderPayments = []) => {
    const store = tenantDoc?.storeInformation || {};
    const owner = tenantDoc?.owner || {};
    const wholesalerLogo = store.storeLogo || tenantDoc?.logo || "";
    const wholesalerName = store.storeName || tenantDoc?.companyName || process.env.COMPANY_NAME || "DigiOptics Wholesale";
    const wholesalerAddress = store.address || process.env.COMPANY_ADDRESS || "WeWork Eldeco Centre, Block A, Malviya Nagar, New Delhi";
    const wholesalerEmail = owner.email || process.env.COMPANY_EMAIL || "support@digioptics.com";
    const wholesalerPhone = store.storeMobileNumber || owner.mobileNumber || process.env.COMPANY_PHONE || "+91 9650560526";
    const wholesalerGstin = tenantDoc?.gstNumber || process.env.COMPANY_GSTIN || "GST9876543210";

    const customerAddress = customer?.billToAddress?.address || bulkOrder.customer?.customerShipToBranchName || "";
    const customerPhone = customer?.mobileNo1 || customer?.mobile || bulkOrder.customer?.customerPhone || "";
    const customerGstin = customer?.gstNumber || customer?.gstin || "";
    const customerName = bulkOrder.customer?.customerName || customer?.shopName || "Customer";

    const totalPaidAmount = orderPayments.length > 0
        ? orderPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
        : Number(bulkOrder.advanceAmount || 0);

    return {
        billNumber:     bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString(),
        orderDate:      bulkOrder.createdAt,
        deliveryDate:   bulkOrder.orders?.[0]?.estimatedDeliveryDate || bulkOrder.createdAt,
        deliveryBy:     bulkOrder.orders?.[0]?.statusHistory?.[0]?.changedByName || "60",
        companyLogo:    wholesalerLogo,
        companyName:    wholesalerName,
        companyAddress: wholesalerAddress,
        companyEmail:   wholesalerEmail,
        companyPhone:   wholesalerPhone,
        companyGstin:   wholesalerGstin,
        customerName,
        customerAddress,
        customerPhone,
        customerGstin,
        orders:         bulkOrder.orders,
        shippingCharges:Number(bulkOrder.shippingCharges || 0),
        otherCharges:   Number(bulkOrder.otherCharges || 0),
        advanceAmount:  Number(bulkOrder.advanceAmount || 0),
        paidAmount:     totalPaidAmount,
        totalPaidAmount,
        orderPayments,
        bankDetails: {
            bankName:      tenantDoc?.invoiceDetails?.bankName || tenantDoc?.bankName || "South Indian Bank Ltd.",
            bankAccountNo: tenantDoc?.invoiceDetails?.bankAccountNo || tenantDoc?.bankAccountNo || "0828073000000655",
            bankIFSC:      tenantDoc?.invoiceDetails?.bankIFSC || tenantDoc?.bankIFSC || "SIBL0000828",
            bankBranch:    tenantDoc?.invoiceDetails?.bankBranch || tenantDoc?.bankBranch || "Siliguri Branch.",
        },
        upiId: tenantDoc?.invoiceDetails?.upiId || tenantDoc?.upiId || "saanchi@upi",
    };
};

const buildInvoiceData = (bulkOrder, customer, tenantDoc = null, orderPayments = []) => {
    const store = tenantDoc?.storeInformation || {};
    const owner = tenantDoc?.owner || {};
    const wholesalerLogo = store.storeLogo || tenantDoc?.logo || "";
    const wholesalerName = store.storeName || tenantDoc?.companyName || process.env.COMPANY_NAME || "DigiOptics Wholesale";
    const wholesalerAddress = store.address || process.env.COMPANY_ADDRESS || "WeWork Eldeco Centre, Block A, Shivalik Colony, Malviya Nagar, New Delhi, Delhi 110017";
    const wholesalerCity = store.city || "New Delhi";
    const wholesalerGstin = tenantDoc?.gstNumber || process.env.COMPANY_GSTIN || "GST9876543210";

    const billTo = customer?.billToAddress || {};
    const customerAddress = billTo.address || bulkOrder.customer?.customerShipToBranchName || "";
    const customerPhone = customer?.mobileNo1 || customer?.mobile || billTo.customerContactNumber || bulkOrder.customer?.customerPhone || "";
    const customerGstin = customer?.gstNumber || billTo.gstin || "";
    const customerName = bulkOrder.customer?.customerName || customer?.shopName || "Customer";

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
    const shippingCharges= Number(bulkOrder.shippingCharges || 0);
    const otherCharges   = Number(bulkOrder.otherCharges || 0);
    const advanceAmount  = Number(bulkOrder.advanceAmount || 0);
    const grandTotal     = taxableAmount + cgstAmount + sgstAmount + shippingCharges + otherCharges;
    const totalPaidAmount = orderPayments.length > 0
        ? orderPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
        : advanceAmount;
    const balanceDue     = Math.max(0, grandTotal - totalPaidAmount);

    return {
        invoiceNo:       bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString(),
        invoiceDate:     bulkOrder.createdAt,
        orderDate:       bulkOrder.createdAt,
        deliveryDate:    bulkOrder.orders?.[0]?.estimatedDeliveryDate || bulkOrder.createdAt,
        deliveryBy:      bulkOrder.orders?.[0]?.statusHistory?.[0]?.changedByName || "60",
        irnNo:           "",
        placeOfSupply:   billTo.state || "",
        companyName:     wholesalerName,
        companyAddress:  wholesalerAddress,
        companyPhone:    store.storeMobileNumber || owner.mobileNumber || process.env.COMPANY_PHONE || "+91 9650560526",
        companyEmail:    owner.email || process.env.COMPANY_EMAIL || "support@digioptics.com",
        companyGstin:    wholesalerGstin,
        companyLogo:     wholesalerLogo,
        customerName,
        customerAddress,
        customerPhone,
        customerGstin,
        orders:          bulkOrder.orders,
        items:           allItems,
        totalQty,
        grossAmount:     grossAmount.toFixed(2),
        discountAmount:  discountAmount.toFixed(2),
        taxableAmount:   taxableAmount.toFixed(2),
        cgstAmount,
        sgstAmount,
        igstAmount:      0,
        shippingCharges,
        otherCharges,
        advanceAmount,
        paidAmount:      totalPaidAmount,
        totalPaidAmount,
        grandTotal:      grandTotal.toFixed(2),
        balanceDue:      balanceDue.toFixed(2),
        orderPayments,
        bankDetails: {
            bankName:      tenantDoc?.invoiceDetails?.bankName || tenantDoc?.bankName || "South Indian Bank Ltd.",
            bankAccountNo: tenantDoc?.invoiceDetails?.bankAccountNo || tenantDoc?.bankAccountNo || "0828073000000655",
            bankIFSC:      tenantDoc?.invoiceDetails?.bankIFSC || tenantDoc?.bankIFSC || "SIBL0000828",
            bankBranch:    tenantDoc?.invoiceDetails?.bankBranch || tenantDoc?.bankBranch || "Siliguri Branch.",
        },
        upiId: tenantDoc?.invoiceDetails?.upiId || tenantDoc?.upiId || "saanchi@upi",
    };
};

export const generateAndStoreChallan = async (orderId, tenantId) => {
    try {
        const bulkOrder = await BulkOrder.findOne({ _id: orderId, ...(tenantId ? { tenantId } : {}) }).lean();
        if (!bulkOrder) throw new Error("BulkOrder not found");

        const effectiveTenantId = tenantId || bulkOrder.tenantId;
        const [customerDoc, tenantDoc] = await Promise.all([
            Customer.findOne({ _id: bulkOrder.customer?.customerId }).lean(),
            effectiveTenantId ? Tenant.findOne({ tenantId: effectiveTenantId }).lean() : null
        ]);

        const customer = customerDoc;
        const orderNumber = bulkOrder.orders?.[0]?.orderNumber || bulkOrder._id.toString();

        // Fetch customer payments to map all part payments allocated to this order
        const customerPayments = await Payment.find({
            partyId: bulkOrder.customer?.customerId,
            ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {})
        }).sort({ createdAt: 1 }).lean();

        let allocatedSum = 0;
        const orderPayments = [];
        customerPayments.forEach((p) => {
            const alloc = (p.allocations || []).find((a) =>
                String(a.invoiceId) === String(bulkOrder._id) || a.invoiceNumber === orderNumber
            );
            if (alloc) {
                const amt = Number(alloc.allocatedAmount || p.grossAmount || 0);
                allocatedSum += amt;
                orderPayments.push({
                    paymentId: p._id,
                    paymentNumber: p.paymentNumber,
                    paymentDate: p.createdAt,
                    paymentMode: p.paymentMode || "BANK_TRANSFER",
                    referenceNumber: p.paymentDetails?.referenceNumber || p.paymentNumber,
                    amount: amt,
                    remarks: p.paymentDetails?.remarks || "Part Payment Allocation",
                    status: p.chequeDetails?.chequeStatus === "BOUNCED" ? "BOUNCED" : "CLEARED"
                });
            }
        });

        const initialAdvance = Math.max(0, Number((Number(bulkOrder.advanceAmount || 0) - allocatedSum).toFixed(2)));
        if (initialAdvance > 0) {
            orderPayments.unshift({
                paymentId: `ADV-${orderNumber}`,
                paymentNumber: `ADV-${orderNumber}`,
                paymentDate: bulkOrder.createdAt,
                paymentMode: "ADVANCE_ADJUSTMENT",
                referenceNumber: `ADV-${orderNumber}`,
                amount: initialAdvance,
                remarks: "Booking Advance Payment",
                status: "CLEARED"
            });
        }

        const challanData = buildChallanData(bulkOrder, customer, tenantDoc, orderPayments);
        const challanHTML = generateDeliveryChallanHTML(challanData);
        const pdfBuffer   = await generatePDF(challanHTML);
        const fileName    = `challan-${orderNumber}-${Date.now()}.pdf`;
        
        let url = null;
        try {
            url = await uploadPDFToGCS(pdfBuffer, fileName);
            if (url) {
                await BulkOrder.findOneAndUpdate({ _id: orderId }, {
                    challanUrl:   url,
                    challanGenAt: new Date(),
                });
                console.log(`[PDF] Challan stored: ${url}`);
            }
        } catch (uploadErr) {
            console.warn("[PDF] GCS Challan upload skipped:", uploadErr.message);
        }

        return { url, buffer: pdfBuffer };
    } catch (err) {
        console.error("[PDF] generateAndStoreChallan error:", err.message);
        throw err;
    }
};

export const generateAndStoreInvoice = async (orderId, tenantId) => {
    try {
        const bulkOrder = await BulkOrder.findOne({ _id: orderId, ...(tenantId ? { tenantId } : {}) }).lean();
        if (!bulkOrder) throw new Error("BulkOrder not found");

        const effectiveTenantId = tenantId || bulkOrder.tenantId;
        const [customerDoc, tenantDoc] = await Promise.all([
            Customer.findOne({ _id: bulkOrder.customer?.customerId }).lean(),
            effectiveTenantId ? Tenant.findOne({ tenantId: effectiveTenantId }).lean() : null
        ]);

        const customer = customerDoc;
        const orderNumber = bulkOrder.orders?.[0]?.orderNumber || bulkOrder._id.toString();

        // Fetch customer payments to map all part payments allocated to this order
        const customerPayments = await Payment.find({
            partyId: bulkOrder.customer?.customerId,
            ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {})
        }).sort({ createdAt: 1 }).lean();

        let allocatedSum = 0;
        const orderPayments = [];
        customerPayments.forEach((p) => {
            const alloc = (p.allocations || []).find((a) =>
                String(a.invoiceId) === String(bulkOrder._id) || a.invoiceNumber === orderNumber
            );
            if (alloc) {
                const amt = Number(alloc.allocatedAmount || p.grossAmount || 0);
                allocatedSum += amt;
                orderPayments.push({
                    paymentId: p._id,
                    paymentNumber: p.paymentNumber,
                    paymentDate: p.createdAt,
                    paymentMode: p.paymentMode || "BANK_TRANSFER",
                    referenceNumber: p.paymentDetails?.referenceNumber || p.paymentNumber,
                    amount: amt,
                    remarks: p.paymentDetails?.remarks || "Part Payment Allocation",
                    status: p.chequeDetails?.chequeStatus === "BOUNCED" ? "BOUNCED" : "CLEARED"
                });
            }
        });

        const initialAdvance = Math.max(0, Number((Number(bulkOrder.advanceAmount || 0) - allocatedSum).toFixed(2)));
        if (initialAdvance > 0) {
            orderPayments.unshift({
                paymentId: `ADV-${orderNumber}`,
                paymentNumber: `ADV-${orderNumber}`,
                paymentDate: bulkOrder.createdAt,
                paymentMode: "ADVANCE_ADJUSTMENT",
                referenceNumber: `ADV-${orderNumber}`,
                amount: initialAdvance,
                remarks: "Booking Advance Payment",
                status: "CLEARED"
            });
        }

        const invoiceData = buildInvoiceData(bulkOrder, customer, tenantDoc, orderPayments);
        const invoiceHTML = generatedorderInvoice(invoiceData);
        const pdfBuffer   = await generatePDF(invoiceHTML);
        const fileName    = `invoice-${orderNumber}-${Date.now()}.pdf`;
        
        let url = null;
        try {
            url = await uploadPDFToGCS(pdfBuffer, fileName);
            if (url) {
                await BulkOrder.findOneAndUpdate({ _id: orderId }, {
                    invoiceUrl:   url,
                    invoiceGenAt: new Date(),
                });
                console.log(`[PDF] Invoice stored: ${url}`);
            }
        } catch (uploadErr) {
            console.warn("[PDF] GCS Invoice upload skipped:", uploadErr.message);
        }

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
