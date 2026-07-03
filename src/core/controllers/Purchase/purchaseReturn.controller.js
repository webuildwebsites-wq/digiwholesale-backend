import mongoose from "mongoose";
import PurchaseReturn from "../../../models/Purchase/PurchaseReturn.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

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
        const returnDoc = await PurchaseReturn.findById(id).lean();
        if (!returnDoc) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase return not found");
        return sendSuccessResponse(res, 200, { return: returnDoc });
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_RETURN_ERROR", error.message);
    }
};

export const updatePurchaseReturnStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }

        const allowed = ["Pending", "VendorNotified", "Replaced", "Closed"];
        if (!status || !allowed.includes(status)) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Status must be one of: ${allowed.join(", ")}`);
        }

        const returnDoc = await PurchaseReturn.findById(id);
        if (!returnDoc) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase return not found");

        returnDoc.status = status;
        if (remarks) returnDoc.remarks = remarks;
        if (status === "VendorNotified") {
            returnDoc.vendorNotified   = true;
            returnDoc.vendorNotifiedAt = new Date();
        }
        await returnDoc.save();

        return sendSuccessResponse(res, 200, { return: returnDoc }, `Purchase return marked as ${status}`);

    } catch (error) {
        return sendErrorResponse(res, 500, "UPDATE_RETURN_ERROR", error.message);
    }
};
