import mongoose from "mongoose";
import PurchaseInward from "../../../models/Purchase/PurchaseInward.model.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

export const createPurchaseInward = async (req, res) => {
    try {
        const { purchaseOrderId, items, remarks } = req.body;

        if (!purchaseOrderId || !mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid purchaseOrderId is required");
        }
        if (!Array.isArray(items) || items.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "items array is required");
        }

        const purchaseOrder = await VendorPurchase.findById(purchaseOrderId);
        if (!purchaseOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        }

        const errors = [];

        for (const entry of items) {
            const { orderNumber, itemIndex, receivedQty, condition, vendorRefId, remarks: itemRemark } = entry;

            if (!orderNumber || itemIndex === undefined || receivedQty === undefined) {
                errors.push(`Missing fields in entry: ${JSON.stringify(entry)}`);
                continue;
            }

            const order = purchaseOrder.orders.find(o => o.orderNumber === orderNumber);
            if (!order) { errors.push(`Order not found: ${orderNumber}`); continue; }

            const item = order.items[itemIndex];
            if (!item) { errors.push(`Item index ${itemIndex} not found in order ${orderNumber}`); continue; }

            const received = Number(receivedQty);
            if (received < 0) { errors.push(`receivedQty cannot be negative for ${item.itemName}`); continue; }

            item.receivedQty   = received;
            item.inwardStatus  = received === 0
                ? "NOT_RECEIVED"
                : received < item.qty
                    ? "PARTIAL"
                    : "RECEIVED";

            if (vendorRefId) {
                item.vendorRefId          = vendorRefId;
                item.vendorRefIdUpdatedAt = new Date();
                item.vendorRefIdUpdatedBy = req.user._id;
            }
        }

        const allItems = purchaseOrder.orders.flatMap(o => o.items);
        const allReceived  = allItems.every(i => i.inwardStatus === "RECEIVED");
        const anyReceived  = allItems.some(i => ["RECEIVED", "PARTIAL"].includes(i.inwardStatus));

        for (const order of purchaseOrder.orders) {
            order.status = allReceived ? "Received" : anyReceived ? "PartiallyReceived" : "Submitted";
        }

        await purchaseOrder.save();

        const inwardItems = items
            .filter(entry => {
                const order = purchaseOrder.orders.find(o => o.orderNumber === entry.orderNumber);
                return order && order.items[entry.itemIndex];
            })
            .map(entry => {
                const order = purchaseOrder.orders.find(o => o.orderNumber === entry.orderNumber);
                const item  = order.items[entry.itemIndex];
                return {
                    orderNumber:  entry.orderNumber,
                    itemIndex:    entry.itemIndex,
                    itemName:     item.itemName,
                    productId:    item.productId,
                    category:     item.category,
                    unit:         item.unit,
                    orderedQty:   item.qty,
                    receivedQty:  Number(entry.receivedQty),
                    vendorRefId:  entry.vendorRefId || item.vendorRefId,
                    condition:    entry.condition   || "GOOD",
                    remarks:      entry.remarks,
                };
            });

        const inward = await PurchaseInward.create({
            purchaseOrderId,
            vendorId:   purchaseOrder.vendor.vendorId,
            vendorName: purchaseOrder.vendor.vendorName,
            inwardDate: new Date(),
            items:      inwardItems,
            remarks,
            status:     "Confirmed",
            createdBy:  req.user._id,
        });

        return sendSuccessResponse(res, 201, {
            inward,
            errors: errors.length ? errors : undefined,
        }, "Purchase inward recorded successfully");

    } catch (error) {
        console.error("Create Purchase Inward Error:", error);
        return sendErrorResponse(res, 500, "CREATE_INWARD_ERROR", error.message);
    }
};

export const getAllPurchaseInwards = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const filter = {};
        if (req.query.purchaseOrderId && mongoose.Types.ObjectId.isValid(req.query.purchaseOrderId)) {
            filter.purchaseOrderId = new mongoose.Types.ObjectId(req.query.purchaseOrderId);
        }
        if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
            filter.vendorId = new mongoose.Types.ObjectId(req.query.vendorId);
        }

        const [inwards, total] = await Promise.all([
            PurchaseInward.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PurchaseInward.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            inwards,
            pagination: {
                currentPage: page,
                totalPages:  Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Purchase inwards retrieved successfully");

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_INWARDS_ERROR", error.message);
    }
};

export const getPurchaseInwardById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }
        const inward = await PurchaseInward.findById(id).lean();
        if (!inward) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase inward not found");
        return sendSuccessResponse(res, 200, { inward });
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_INWARD_ERROR", error.message);
    }
};
