import mongoose from "mongoose";
import ReturnRefund from "../../../models/SALES/ReturnRefund.model.js";
import { uploadReturnRefundFile } from "../../../Utils/uploads/returnRefund.upload.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

/* =====================================================
   CREATE RETURN / REFUND REQUEST
===================================================== */
export const createReturnRefund = async (req, res) => {
  try {
    const {
      name, phone, email,
      dateOfPurchase, itemType, condition, reasonForReturn,
      items,
      refundAmount, refundMethod, loyaltyPoints,
      remark,
    } = req.body;

    // ── Validate required fields ──────────────────
    if (!name)             throw new Error("Customer name is required");
    if (!phone)            throw new Error("Phone number is required");
    if (!dateOfPurchase)   throw new Error("Date of purchase is required");
    if (!itemType)         throw new Error("Item type is required");
    if (!condition)        throw new Error("Condition is required");
    if (!reasonForReturn)  throw new Error("Reason for return is required");
    if (!refundAmount)     throw new Error("Refund amount is required");
    if (!refundMethod)     throw new Error("Refund method is required");

    // ── Parse items (sent as JSON string from FormData) ──
    let parsedItems = items;
    if (typeof items === "string") {
      parsedItems = JSON.parse(items);
    }
    if (!parsedItems || !parsedItems.length) {
      throw new Error("At least one item is required");
    }

    // ── Upload photos (req.files from multer) ────
    let photos = [];
    if (req.files && req.files.photos && req.files.photos.length > 0) {
      const uploadPromises = req.files.photos.map((file) =>
        uploadReturnRefundFile(file, "return-refund/photos")
      );
      photos = await Promise.all(uploadPromises);
    }

    // ── Upload gift voucher image (optional) ─────
    let giftVoucherUrl = null;
    if (req.files && req.files.giftVoucher && req.files.giftVoucher.length > 0) {
      giftVoucherUrl = await uploadReturnRefundFile(
        req.files.giftVoucher[0],
        "return-refund/vouchers"
      );
    }

    const returnRefund = await ReturnRefund.create({
      name: name.trim().toUpperCase(),
      phone: phone.trim(),
      email: email?.trim(),
      dateOfPurchase: new Date(dateOfPurchase),
      itemType,
      condition,
      reasonForReturn,
      items: parsedItems,
      refundAmount: Number(refundAmount),
      refundMethod,
      loyaltyPoints: Number(loyaltyPoints) || 0,
      giftVoucherUrl,
      photos,
      remark,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    return sendSuccessResponse(res, 201, { returnRefund }, "Return & Refund request created successfully");

  } catch (error) {
    console.error("Create ReturnRefund Error:", error);
    return sendErrorResponse(res, 400, "CREATE_RETURN_REFUND_ERROR", error.message);
  }
};

/* =====================================================
   GET ALL RETURN / REFUND REQUESTS (PAGINATED)
===================================================== */
export const getAllReturnRefunds = async (req, res) => {
  try {

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    // Optional status filter  ?status=Pending
    const filter = {  };
    if (req.query.status) filter.status = req.query.status;

    const [returnRefunds, total] = await Promise.all([
      ReturnRefund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ReturnRefund.countDocuments(filter),
    ]);

    return sendSuccessResponse(res, 200, {
      page,
      limit,
      total,
      count: returnRefunds.length,
      hasMore: skip + returnRefunds.length < total,
      returnRefunds,
    });

  } catch (error) {
    return sendErrorResponse(res, 500, "GET_RETURN_REFUNDS_ERROR", error.message);
  }
};

/* =====================================================
   GET SINGLE RETURN / REFUND REQUEST
===================================================== */
export const getReturnRefundById = async (req, res) => {
  try {
    const returnRefund = await ReturnRefund.findOne({
      _id: req.params.id,
    });

    if (!returnRefund) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Return/Refund request not found");
    }

    return sendSuccessResponse(res, 200, { returnRefund });

  } catch (error) {
    return sendErrorResponse(res, 400, "GET_RETURN_REFUND_ERROR", error.message);
  }
};

/* =====================================================
   UPDATE STATUS  (Approve / Reject / Complete)
===================================================== */
export const updateReturnRefundStatus = async (req, res) => {
  try {
    const { status, remark } = req.body;

    const allowed = ["Pending", "Approved", "Rejected", "Completed"];
    if (!status || !allowed.includes(status)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Status must be one of: ${allowed.join(", ")}`);
    }

    const returnRefund = await ReturnRefund.findOne({
      _id: req.params.id,
    });

    if (!returnRefund) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Return/Refund request not found");
    }

    returnRefund.status = status;
    if (remark) returnRefund.remark = remark;
    await returnRefund.save();

    return sendSuccessResponse(res, 200, { returnRefund }, `Request marked as ${status}`);

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_STATUS_ERROR", error.message);
  }
};

/* =====================================================
   UPDATE RETURN / REFUND REQUEST (full edit)
===================================================== */
export const updateReturnRefund = async (req, res) => {
  try {
    const returnRefund = await ReturnRefund.findOne({
      _id: req.params.id,
    });

    if (!returnRefund) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Return/Refund request not found");
    }

    const editableFields = [
      "name", "phone", "email",
      "dateOfPurchase", "itemType", "condition", "reasonForReturn",
      "items",
      "refundAmount", "refundMethod", "loyaltyPoints",
      "remark",
    ];

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        returnRefund[field] = req.body[field];
      }
    });

    await returnRefund.save();

    return sendSuccessResponse(res, 200, { returnRefund }, "Return/Refund request updated successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_RETURN_REFUND_ERROR", error.message);
  }
};

/* =====================================================
   DELETE RETURN / REFUND REQUEST
===================================================== */
export const deleteReturnRefund = async (req, res) => {
  try {
    const returnRefund = await ReturnRefund.findOneAndDelete({
      _id: req.params.id,
    });

    if (!returnRefund) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Return/Refund request not found");
    }

    return sendSuccessResponse(res, 200, null, "Return/Refund request deleted successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "DELETE_RETURN_REFUND_ERROR", error.message);
  }
};

/* =====================================================
   FILTER / SEARCH
===================================================== */
export const filterReturnRefunds = async (req, res) => {
  try {
    const { startDate, endDate, keyword, status } = req.body;

    if (!startDate && !keyword && !status) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Date range, keyword, or status is required");
    }

    let query = {  };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end   = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    if (status) query.status = status;

    if (keyword) {
      const regex = new RegExp(keyword, "i");
      query.$or = [
        { name: regex },
        { phone: regex },
        { itemType: regex },
        { reasonForReturn: regex },
        { "items.item": regex },
      ];
    }

    const returnRefunds = await ReturnRefund.find(query).sort({ createdAt: -1 });

    if (!returnRefunds.length) {
      return sendErrorResponse(res, 200, "NO_DATA", "No records found with this filter");
    }

    return sendSuccessResponse(res, 200, {
      total: returnRefunds.length,
      returnRefunds,
    });

  } catch (error) {
    console.error("Filter ReturnRefund Error:", error);
    return sendErrorResponse(res, 500, "FILTER_RETURN_REFUND_ERROR", error.message);
  }
};
