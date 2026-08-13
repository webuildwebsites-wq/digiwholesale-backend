import mongoose from "mongoose";
import PurchaseProposal from "../../../models/Purchase/PurchaseProposal.model.js";
import VendorPurchase   from "../../../models/Purchase/VendorPurchase.model.js";
import Vendor           from "../../../models/Vendor.model.js";
import DigiProduct      from "../../../models/Product/Product.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { sendEmail }            from "../../config/Email/emailService.js";
import { sendWhatsAppMessage }  from "../../../Utils/whatsapp/whatsappService.js";
import VendorProposalTemplate   from "../../../Utils/Mail/VendorProposalTemplate.js";
import { generatePurchaseOrderExcel } from "../../../Utils/excel/generatePurchaseOrderExcel.js";

const generateProposalNumber = () =>
    `PR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const generatePurchaseOrderNumber = () =>
    `PO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const notifyVendors = async ({ proposal, vendorDocs }) => {
    const proposalDate  = new Date(proposal.createdAt).toLocaleDateString("en-IN");
    const requiredByDate = proposal.requiredByDate
        ? new Date(proposal.requiredByDate).toLocaleDateString("en-IN")
        : null;

    const notifications = [];

    for (const vendor of vendorDocs) {
        const html = VendorProposalTemplate({
            vendorName:      vendor.name,
            proposalNumber:  proposal.proposalNumber,
            proposalDate,
            product:         proposal.product,
            requiredQty:     proposal.requiredQty,
            requiredByDate,
            description:     proposal.description,
        });

        if (vendor.email) {
            notifications.push(
                sendEmail({
                    to:      vendor.email,
                    subject: `Purchase Proposal ${proposal.proposalNumber} — DigiOptics`,
                    html,
                }).catch(err => console.error(`[PR] Email error for vendor ${vendor._id}:`, err.message))
            );
        }

        if (vendor.mobile) {
            const msg = `Hello ${vendor.name} 👋,\n\nWe have sent you a *Purchase Proposal* on *DigiOptics Wholesale*.\n\n*Details:*\n• Proposal No: ${proposal.proposalNumber}\n• Product: ${proposal.product.productName}\n• Required Qty: ${proposal.requiredQty} ${proposal.product.unit}\n${requiredByDate ? `• Required By: ${requiredByDate}\n` : ""}\nPlease check your email and share your best quotation.\n\nThank you,\n*DigiOptics Wholesale Team*`;
            notifications.push(
                sendWhatsAppMessage({ to: vendor.mobile, message: msg })
                    .catch(err => console.error(`[PR] WhatsApp error for vendor ${vendor._id}:`, err.message))
            );
        }
    }

    await Promise.all(notifications);
};

export const createPurchaseProposal = async (req, res) => {
    try {
        const {
            productId,
            productName,
            productCode,
            category,
            brand,
            unit,
            requiredQty,
            requiredByDate,
            description,
            vendorIds,
        } = req.body;

        if (!productName || !requiredQty || !Array.isArray(vendorIds) || vendorIds.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "productName, requiredQty and at least one vendorId are required");
        }

        const invalidIds = vendorIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return sendErrorResponse(res, 400, "INVALID_ID", `Invalid vendorId(s): ${invalidIds.join(", ")}`);
        }

        const vendors = await Vendor.find({ _id: { $in: vendorIds }, tenantId: req.user.tenantId }).lean();
        if (vendors.length !== vendorIds.length) {
            const foundIds  = vendors.map(v => v._id.toString());
            const missing   = vendorIds.filter(id => !foundIds.includes(id));
            return sendErrorResponse(res, 404, "VENDOR_NOT_FOUND", `Vendor(s) not found: ${missing.join(", ")}`);
        }

        let currentQty = 0;
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            const product = await DigiProduct.findOne({ _id: productId, tenantId: req.user.tenantId }).lean();
            if (product) currentQty = product.qty ?? 0;
        }

        const vendorQuotations = vendors.map(v => ({
            vendorId:   v._id,
            vendorName: v.name,
            email:      v.email   || "",
            mobile:     v.mobile  || "",
            quotation:  null,
            quotedAt:   null,
            status:     "PENDING",
        }));

        const proposal = await PurchaseProposal.create({
            proposalNumber:   generateProposalNumber(),
            product: {
                productId:   productId || null,
                productCode: productCode || "",
                productName: productName.trim().toUpperCase(),
                category:    (category || "").toUpperCase(),
                brand:       (brand    || "").toUpperCase(),
                unit:        unit || "PIECE",
                currentQty,
            },
            requiredQty:      Number(requiredQty),
            requiredByDate:   requiredByDate ? new Date(requiredByDate) : null,
            description:      description || "",
            vendorQuotations,
            status:           "SENT",
            createdBy:        req.user._id,
            createdByName:    req.user.employeeName || req.user.name || "",
            tenantId:         req.user.tenantId,
        });

        notifyVendors({ proposal, vendorDocs: vendors }).catch(err =>
            console.error("[PR] Notification error:", err.message)
        );

        return sendSuccessResponse(res, 201, { proposal }, `Purchase proposal created and sent to ${vendors.length} vendor(s) successfully`);
    } catch (error) {
        console.error("Create Purchase Proposal Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};

export const getAllPurchaseProposals = async (req, res) => {
    try {
        const page   = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip   = (page - 1) * limit;
        const { status, search, fromDate, toDate } = req.query;

        const filter = { tenantId: req.user.tenantId };

        if (status) filter.status = status;

        if (search) {
            const regex = { $regex: search.trim(), $options: "i" };
            filter.$or  = [
                { proposalNumber:          regex },
                { "product.productName":   regex },
                { "product.productCode":   regex },
                { "product.brand":         regex },
            ];
        }

        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const [proposals, total] = await Promise.all([
            PurchaseProposal.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PurchaseProposal.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            proposals,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Purchase proposals retrieved successfully");
    } catch (error) {
        console.error("Get All Purchase Proposals Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};

export const getPurchaseProposalById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid proposal ID");
        }

        const proposal = await PurchaseProposal.findOne({ _id: id, tenantId: req.user.tenantId }).lean();

        if (!proposal) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase proposal not found");
        }

        return sendSuccessResponse(res, 200, { proposal }, "Purchase proposal retrieved successfully");
    } catch (error) {
        console.error("Get Purchase Proposal Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};

export const submitVendorQuotation = async (req, res) => {
    try {
        const { id, quotationId } = req.params;
        const { price, availableQty, deliveryDays, deliveryDetails, gst, hsnSac, remarks } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(quotationId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid proposal ID or quotation ID");
        }

        if (price === undefined || availableQty === undefined) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "price and availableQty are required");
        }

        const proposal = await PurchaseProposal.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!proposal) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase proposal not found");
        }

        if (["FINALIZED", "ORDERED", "CANCELLED"].includes(proposal.status)) {
            return sendErrorResponse(res, 400, "INVALID_STATUS", `Cannot update quotation on a ${proposal.status} proposal`);
        }

        const quotation = proposal.vendorQuotations.id(quotationId);
        if (!quotation) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Vendor quotation not found");
        }

        quotation.quotation = {
            price:           Number(price),
            availableQty:    Number(availableQty),
            deliveryDays:    deliveryDays ? Number(deliveryDays) : null,
            deliveryDetails: deliveryDetails || "",
            gst:             Number(gst     || 0),
            hsnSac:          hsnSac         || "",
            remarks:         remarks        || "",
        };
        quotation.quotedAt = new Date();
        quotation.status   = "QUOTED";

        const anyQuoted = proposal.vendorQuotations.some(q => q.status === "QUOTED");
        if (anyQuoted) proposal.status = "QUOTED";

        await proposal.save();

        return sendSuccessResponse(res, 200, { proposal }, "Vendor quotation submitted successfully");
    } catch (error) {
        console.error("Submit Vendor Quotation Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};

export const finalizePurchaseProposal = async (req, res) => {
    try {
        const { id }        = req.params;
        const { quotationId, cgst, sgst } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(quotationId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid proposal ID or quotation ID");
        }

        const proposal = await PurchaseProposal.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!proposal) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase proposal not found");
        }

        if (proposal.status === "ORDERED") {
            return sendErrorResponse(res, 400, "INVALID_STATUS", "Purchase order already placed for this proposal");
        }

        if (proposal.status === "CANCELLED") {
            return sendErrorResponse(res, 400, "INVALID_STATUS", "Cannot finalize a cancelled proposal");
        }

        const selectedQuotation = proposal.vendorQuotations.id(quotationId);
        if (!selectedQuotation) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Quotation not found");
        }

        if (!selectedQuotation.quotation) {
            return sendErrorResponse(res, 400, "NO_QUOTATION", "Selected vendor has not submitted a quotation yet");
        }

        const vendor = await Vendor.findOne({ _id: selectedQuotation.vendorId, tenantId: req.user.tenantId }).lean();
        if (!vendor) {
            return sendErrorResponse(res, 404, "VENDOR_NOT_FOUND", "Vendor not found");
        }

        proposal.vendorQuotations.forEach(q => {
            q.status = q._id.toString() === quotationId ? "SELECTED" : "REJECTED";
        });
        proposal.selectedVendorId = selectedQuotation.vendorId;
        proposal.status           = "FINALIZED";
        await proposal.save();

        const { price, availableQty, gst: quotedGst, hsnSac } = selectedQuotation.quotation;

        const purchaseOrder = await VendorPurchase.create({
            vendor: {
                vendorId:   vendor._id,
                vendorName: vendor.name,
                email:      vendor.email     || "",
                mobile:     vendor.mobile    || "",
                address:    vendor.address   || "",
                gstNumber:  vendor.gstNumber || "",
            },
            orders: [{
                orderNumber: generatePurchaseOrderNumber(),
                items: [{
                    productId:    proposal.product.productId || null,
                    isNewProduct: !proposal.product.productId,
                    orderType:    "STOCK",
                    itemName:     proposal.product.productName,
                    category:     proposal.product.category,
                    unit:         proposal.product.unit,
                    brand:        proposal.product.brand,
                    code:         proposal.product.productCode,
                    price:        price,
                    mrp:          price,
                    gst:          quotedGst  || 0,
                    hsnSac:       hsnSac     || "",
                    qty:          proposal.requiredQty,
                    inwardStatus: "PENDING",
                    qcStatus:     "PENDING",
                }],
                cgst:   cgst ? String(cgst) : "0",
                sgst:   sgst ? String(sgst) : "0",
                status: "Submitted",
            }],
            createdBy: req.user._id,
            tenantId:  req.user.tenantId,
            sourceProposalId: proposal._id,
        });

        proposal.finalPurchaseOrderId = purchaseOrder._id;
        proposal.status               = "ORDERED";
        await proposal.save();

        const excelBuffer = generatePurchaseOrderExcel(purchaseOrder.toObject());

        if (vendor.email) {
            sendEmail({
                to:      vendor.email,
                subject: `Purchase Order Confirmed — ${purchaseOrder.orders[0].orderNumber} — DigiOptics`,
                html:    `<p>Dear ${vendor.name},</p><p>Your quotation for <b>${proposal.product.productName}</b> has been accepted. Please find the purchase order attached.</p><p>Proposal Ref: ${proposal.proposalNumber}</p>`,
                attachments: [{
                    name:    `PO-${purchaseOrder.orders[0].orderNumber}.xlsx`,
                    content: excelBuffer.toString("base64"),
                }],
            }).catch(err => console.error("[PR] Finalize email error:", err.message));
        }

        if (vendor.mobile) {
            sendWhatsAppMessage({
                to:      vendor.mobile,
                message: `Hello ${vendor.name} 👋,\n\nYour quotation for *${proposal.product.productName}* has been *ACCEPTED*.\n\n*Purchase Order:* ${purchaseOrder.orders[0].orderNumber}\n*Qty:* ${proposal.requiredQty} ${proposal.product.unit}\n*Price:* ₹${price}\n\nPlease check your email for the complete purchase order.\n\nThank you,\n*DigiOptics Wholesale Team*`,
            }).catch(err => console.error("[PR] Finalize WhatsApp error:", err.message));
        }

        return sendSuccessResponse(res, 201, {
            proposal,
            purchaseOrder,
        }, "Proposal finalized and purchase order created successfully");
    } catch (error) {
        console.error("Finalize Purchase Proposal Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};

export const cancelPurchaseProposal = async (req, res) => {
    try {
        const { id }     = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid proposal ID");
        }

        const proposal = await PurchaseProposal.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!proposal) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase proposal not found");
        }

        if (proposal.status === "ORDERED") {
            return sendErrorResponse(res, 400, "INVALID_STATUS", "Cannot cancel a proposal that already has a purchase order");
        }

        proposal.status      = "CANCELLED";
        proposal.description = reason
            ? `${proposal.description}\n[CANCELLED] ${reason}`.trim()
            : proposal.description;
        await proposal.save();

        return sendSuccessResponse(res, 200, { proposal }, "Purchase proposal cancelled successfully");
    } catch (error) {
        console.error("Cancel Purchase Proposal Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};

export const resendProposalToVendor = async (req, res) => {
    try {
        const { id, quotationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(quotationId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid proposal ID or quotation ID");
        }

        const proposal = await PurchaseProposal.findOne({ _id: id, tenantId: req.user.tenantId }).lean();
        if (!proposal) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase proposal not found");
        }

        const quotation = proposal.vendorQuotations.find(q => q._id.toString() === quotationId);
        if (!quotation) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Vendor quotation not found");
        }

        const vendor = await Vendor.findById(quotation.vendorId).lean();
        if (!vendor) {
            return sendErrorResponse(res, 404, "VENDOR_NOT_FOUND", "Vendor not found");
        }

        await notifyVendors({ proposal, vendorDocs: [vendor] });

        return sendSuccessResponse(res, 200, null, `Proposal resent to ${vendor.name} successfully`);
    } catch (error) {
        console.error("Resend Proposal Error:", error);
        return sendErrorResponse(res, 500, "INTERNAL_ERROR", error.message);
    }
};
