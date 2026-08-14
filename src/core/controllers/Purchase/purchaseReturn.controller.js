import mongoose from "mongoose";
import PurchaseReturn from "../../../models/Purchase/PurchaseReturn.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

const deriveOverallStatus = (items) => {
    const statuses = items.map(i => i.itemStatus);
    if (statuses.every(s => s === "Replaced"))              return "Replaced";
    if (statuses.every(s => s === "Closed"))                return "Closed";
    if (statuses.every(s => s === "Pending"))               return "Pending";
    if (statuses.every(s => s === "VendorNotified"))        return "VendorNotified";
    if (statuses.some(s  => s === "Replaced"))              return "PartiallyReplaced";
    return "VendorNotified";
};

export const getAllPurchaseReturns = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const filter = {};
        if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
            filter.vendorId = new mongoose.Types.ObjectId(req.query.vendorId);
        }
        if (req.query.purchaseOrderId && mongoose.Types.ObjectId.isValid(req.query.purchaseOrderId)) {
            filter.purchaseOrderId = new mongoose.Types.ObjectId(req.query.purchaseOrderId);
        }
        if (req.query.status) filter.status = req.query.status;

        filter.tenantId = req.user.tenantId;

        const [returns, total] = await Promise.all([
            PurchaseReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PurchaseReturn.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            returns,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Purchase returns retrieved successfully");

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_RETURNS_ERROR", error.message);
    }
};

export const getPurchaseReturnById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }
        const returnDoc = await PurchaseReturn.findOne({ _id: id, tenantId: req.user.tenantId }).lean();
        if (!returnDoc) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase return not found");
        return sendSuccessResponse(res, 200, { return: returnDoc });
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_RETURN_ERROR", error.message);
    }
};

export const updateItemStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { itemId, status, remarks } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid return ID");
        }

        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid itemId is required");
        }

        const allowed = ["Pending", "VendorNotified", "Replaced", "Closed"];
        if (!status || !allowed.includes(status)) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", `status must be one of: ${allowed.join(", ")}`);
        }

        const returnDoc = await PurchaseReturn.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!returnDoc) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase return not found");

        const item = returnDoc.items.find(i => i.itemId.toString() === itemId.toString());
        if (!item) {
            return sendErrorResponse(res, 404, "ITEM_NOT_FOUND", `Item not found in this return: ${itemId}`);
        }

        item.itemStatus    = status;
        item.itemUpdatedAt = new Date();
        item.itemUpdatedBy = req.user._id;
        if (remarks) item.itemRemarks = remarks;

        returnDoc.status = deriveOverallStatus(returnDoc.items);

        if (returnDoc.items.some(i => i.itemStatus === "VendorNotified") && !returnDoc.vendorNotified) {
            returnDoc.vendorNotified   = true;
            returnDoc.vendorNotifiedAt = new Date();
        }

        await returnDoc.save();

        return sendSuccessResponse(res, 200, { return: returnDoc }, `Item status updated to ${status}. Overall return status: ${returnDoc.status}`);

    } catch (error) {
        return sendErrorResponse(res, 500, "UPDATE_ITEM_STATUS_ERROR", error.message);
    }
};

export const getShrinkageItems = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const filter = {
            tenantId:        req.user.tenantId,
            "items.condition": "SHRINKAGE",

        };

        if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
            filter.vendorId = new mongoose.Types.ObjectId(req.query.vendorId);
        }
        if (req.query.purchaseOrderId && mongoose.Types.ObjectId.isValid(req.query.purchaseOrderId)) {
            filter.purchaseOrderId = new mongoose.Types.ObjectId(req.query.purchaseOrderId);
        }
        if (req.query.fromDate || req.query.toDate) {
            filter.createdAt = {};
            if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
            if (req.query.toDate) {
                const end = new Date(req.query.toDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const [returns, total] = await Promise.all([
            PurchaseReturn.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .then(docs => docs.map(doc => ({
                    ...doc,
                    items: doc.items.filter(i => i.condition === "SHRINKAGE"),
                }))),
            PurchaseReturn.countDocuments(filter),
        ]);

        const totalShrinkageQty = returns.reduce(
            (sum, r) => sum + r.items.reduce((s, i) => s + (i.qty || 0), 0), 0
        );

        return sendSuccessResponse(res, 200, {
            returns,
            totalShrinkageQty,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Shrinkage items retrieved successfully");

    } catch (error) {
        console.error("Get Shrinkage Items Error:", error);
        return sendErrorResponse(res, 500, "GET_SHRINKAGE_ERROR", error.message);
    }
};

export const getDamagedItems = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const filter = {
            tenantId:          req.user.tenantId,
            "items.condition": "DAMAGED",
        };

        if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
            filter.vendorId = new mongoose.Types.ObjectId(req.query.vendorId);
        }
        if (req.query.purchaseOrderId && mongoose.Types.ObjectId.isValid(req.query.purchaseOrderId)) {
            filter.purchaseOrderId = new mongoose.Types.ObjectId(req.query.purchaseOrderId);
        }
        if (req.query.fromDate || req.query.toDate) {
            filter.createdAt = {};
            if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
            if (req.query.toDate) {
                const end = new Date(req.query.toDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const [returns, total] = await Promise.all([
            PurchaseReturn.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .then(docs => docs.map(doc => ({
                    ...doc,
                    items: doc.items.filter(i => i.condition === "DAMAGED"),
                }))),            PurchaseReturn.countDocuments(filter),
        ]);

        const totalDamagedQty = returns.reduce(
            (sum, r) => sum + r.items.reduce((s, i) => s + (i.qty || 0), 0), 0
        );

        return sendSuccessResponse(res, 200, {
            returns,
            totalDamagedQty,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Damaged items retrieved successfully");

    } catch (error) {
        console.error("Get Damaged Items Error:", error);
        return sendErrorResponse(res, 500, "GET_DAMAGED_ERROR", error.message);
    }
};
