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

        const purchaseOrder = await VendorPurchase.findOne({ _id: purchaseOrderId, tenantId: req.user.tenantId });
        if (!purchaseOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        }

        const allItems = purchaseOrder.orders.flatMap(o =>
            o.items.map(item => ({ order: o, item }))
        );

        const errors      = [];
        const inwardItems = [];

        for (const entry of items) {
            const { itemId, receivedQty, condition, vendorRefId, remarks: itemRemark } = entry;

            if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
                errors.push(`Invalid or missing itemId: ${itemId}`);
                continue;
            }
            if (receivedQty === undefined || receivedQty === null) {
                errors.push(`receivedQty is required for itemId: ${itemId}`);
                continue;
            }

            const found = allItems.find(({ item }) => item._id.toString() === itemId.toString());

            if (!found) {
                errors.push(`Item not found in this purchase order: ${itemId}`);
                continue;
            }

            const { order, item } = found;

            if (item.inwardStatus !== "PENDING") {
                errors.push(`Item already inward processed (status: ${item.inwardStatus}) — ${item.itemName} (itemId: ${itemId})`);
                continue;
            }
            const received = Number(receivedQty);

            if (received < 0) {
                errors.push(`receivedQty cannot be negative for item: ${item.itemName}`);
                continue;
            }

            item.receivedQty  = received;
            item.inwardStatus = received === 0
                ? "NOT_RECEIVED"
                : received < item.qty
                    ? "PARTIAL"
                    : "RECEIVED";

            if (vendorRefId) {
                item.vendorRefId          = vendorRefId;
                item.vendorRefIdUpdatedAt = new Date();
                item.vendorRefIdUpdatedBy = req.user._id;
            }

            inwardItems.push({
                itemId:      item._id,
                orderNumber: order.orderNumber,
                itemName:    item.itemName,
                productId:   item.productId,
                category:    item.category,
                unit:        item.unit,
                orderedQty:  item.qty,
                receivedQty: received,
                vendorRefId: vendorRefId || item.vendorRefId,
                condition:   condition || "GOOD",
                remarks:     itemRemark,
            });
        }

        const flatItems    = purchaseOrder.orders.flatMap(o => o.items);
        const allReceived  = flatItems.every(i => i.inwardStatus === "RECEIVED");
        const anyReceived  = flatItems.some(i => ["RECEIVED", "PARTIAL"].includes(i.inwardStatus));

        for (const order of purchaseOrder.orders) {
            order.status = allReceived ? "Received" : anyReceived ? "PartiallyReceived" : "Submitted";
        }

        await purchaseOrder.save();

        if (inwardItems.length === 0) {
            return sendErrorResponse(res, 400, "UPDATE_FAILED", `All entries failed: ${errors.join(", ")}`);
        }

        const inward = await PurchaseInward.create({
            purchaseOrderId,
            vendorId:   purchaseOrder.vendor.vendorId,
            vendorName: purchaseOrder.vendor.vendorName,
            inwardDate: new Date(),
            items:      inwardItems,
            remarks,
            status:     "Confirmed",
            createdBy:  req.user._id,
            tenantId:   req.user.tenantId,
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
        filter.tenantId = req.user.tenantId;

        const [inwards, total] = await Promise.all([
            PurchaseInward.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PurchaseInward.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            inwards,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
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

        const inward = await PurchaseInward.findOne({ _id: id, tenantId: req.user.tenantId }).lean();
        if (!inward) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase inward not found");

        const purchaseOrder = await VendorPurchase.findById(inward.purchaseOrderId).lean();

        const allPurchaseItems = purchaseOrder
            ? purchaseOrder.orders.flatMap(o => o.items)
            : [];

        const enrichedItems = inward.items.map(inwardItem => {
            const poItem = allPurchaseItems.find(
                pi => pi._id.toString() === inwardItem.itemId.toString()
            );
            return {
                ...inwardItem,
                inwardStatus: poItem?.inwardStatus ?? "PENDING",
                qcStatus:     poItem?.qcStatus     ?? "PENDING",
            };
        });

        return sendSuccessResponse(res, 200, {
            inward: { ...inward, items: enrichedItems },
        });

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_INWARD_ERROR", error.message);
    }
};
