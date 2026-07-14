import mongoose from "mongoose";
import ReturnRefund from "../../../models/SALES/ReturnRefund.model.js";
import { uploadReturnRefundFile } from "../../../Utils/uploads/returnRefund.upload.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import BulkOrder from "../../../models/order/BulkOrder.js";

export const createReturnRefund = async (req, res) => {
  try {
    const {
      name, phone, email,
      dateOfPurchase, itemType, condition, reasonForReturn,
      items,
      refundAmount, refundMethod, loyaltyPoints,
      remark,
      OrderId,
      returnType,
      images,
    } = req.body;

    if (!name)            throw new Error("Customer name is required");
    if (!phone)           throw new Error("Phone number is required");
    if (!email)           throw new Error("Email is required");
    if (!dateOfPurchase)  throw new Error("Date of purchase is required");
    if (!itemType)        throw new Error("Item type is required");
    if (!condition)       throw new Error("Condition is required");
    if (!reasonForReturn) throw new Error("Reason for return is required");
    if (!refundAmount)    throw new Error("Refund amount is required");
    if (!refundMethod)    throw new Error("Refund method is required");
    if (!OrderId)         throw new Error("Order id is required");

    if (!mongoose.Types.ObjectId.isValid(OrderId)) {
      return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid Order ID");
    }

    const bulkOrder = await BulkOrder.findById(OrderId);
    if (!bulkOrder) {
      return sendErrorResponse(res, 404, "ORDER_NOT_FOUND", "Order not found");
    }

    let parsedItems = items;
    if (typeof items === "string") {
      parsedItems = JSON.parse(items);
    }
    if (!parsedItems || !parsedItems.length) {
      throw new Error("At least one item is required");
    }

    const requestedStatus = returnType === "REFUND" ? "REFUND_REQUESTED" : "RETURN_REQUESTED";

    const itemsWithMissingCategory = parsedItems.filter(i => i.productId && !i.category);
    if (itemsWithMissingCategory.length > 0) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Each item must include 'category' to uniquely identify it in the order");
    }

    const matchItem = (orderItem, requestedItem) =>
      orderItem.productId.toString() === requestedItem.productId.toString() &&
      (orderItem.category || "").toUpperCase() === (requestedItem.category || "").toUpperCase();

    const allOrderItems = bulkOrder.orders.flatMap(o => o.items);

    const notFoundItems = parsedItems
      .filter(i => i.productId)
      .filter(i => !allOrderItems.some(oi => matchItem(oi, i)));

    if (notFoundItems.length > 0) {
      const names = notFoundItems.map(i => `${i.item || i.productId} (${i.category})`).join(", ");
      return sendErrorResponse(res, 404, "ITEMS_NOT_IN_ORDER", `The following items do not exist in this order: ${names}`);
    }

    const alreadyInReturnProcess = [];

    for (const requestedItem of parsedItems) {
      if (!requestedItem.productId) continue;
      for (const order of bulkOrder.orders) {
        for (const item of order.items) {
          if (matchItem(item, requestedItem)) {
            if (item.itemStatus && item.itemStatus !== "ACTIVE") {
              alreadyInReturnProcess.push({
                productId: item.productId,
                itemName: item.itemName,
                currentStatus: item.itemStatus,
              });
            }
          }
        }
      }
    }

    if (alreadyInReturnProcess.length > 0) {
      const itemNames = alreadyInReturnProcess.map(i => `${i.itemName} (${i.currentStatus})`).join(", ");
      return sendErrorResponse(res, 400, "ITEMS_ALREADY_IN_RETURN_PROCESS", `The following items are already in return/refund process: ${itemNames}`);
    }

    for (const requestedItem of parsedItems) {
      if (!requestedItem.productId) continue;
      for (const order of bulkOrder.orders) {
        for (const item of order.items) {
          if (matchItem(item, requestedItem)) {
            item.itemStatus = requestedStatus;
          }
        }
      }
    }

    await bulkOrder.save();

    let photos = [];
    if (req.files && req.files.photos && req.files.photos.length > 0) {
      const uploadPromises = req.files.photos.map((file) =>
        uploadReturnRefundFile(file, "return-refund/photos")
      );
      photos = await Promise.all(uploadPromises);
    }

    let giftVoucherUrl = null;
    if (req.files && req.files.giftVoucher && req.files.giftVoucher.length > 0) {
      giftVoucherUrl = await uploadReturnRefundFile(
        req.files.giftVoucher[0],
        "return-refund/vouchers"
      );
    }

    const enrichedItems = parsedItems.map((i) => ({
      ...i,
      returnType: requestedStatus,
      category: (i.category || "").toUpperCase(),
      orderNumber: bulkOrder.orders.find((o) =>
        o.items.some((it) =>
          it.productId.toString() === (i.productId || "").toString() &&
          (it.category || "").toUpperCase() === (i.category || "").toUpperCase()
        )
      )?.orderNumber || "",
    }));

    const topLevelImages = Array.isArray(images) ? images : [];

    const returnRefund = await ReturnRefund.create({
      name: name.trim().toUpperCase(),
      phone: phone.trim(),
      email: email?.trim(),
      dateOfPurchase: new Date(dateOfPurchase),
      itemType,
      condition,
      reasonForReturn,
      items: enrichedItems,
      refundAmount: Number(refundAmount),
      refundMethod,
      loyaltyPoints: Number(loyaltyPoints) || 0,
      giftVoucherUrl,
      photos: topLevelImages,
      remark,
      createdBy: req.user._id,
      createdByName: req.user.employeeName || req.user.name,
    });

    return sendSuccessResponse(res, 201, { returnRefund }, "Return & Refund request created successfully");

  } catch (error) {
    console.error("Create ReturnRefund Error:", error);
    return sendErrorResponse(res, 400, "CREATE_RETURN_REFUND_ERROR", error.message);
  }
};

export const getAllReturnRefunds = async (req, res) => {
  try {

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const filter = {  };
    if (req.query.status) filter.status = req.query.status;

    const [returnRefunds, total] = await Promise.all([
      ReturnRefund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ReturnRefund.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(res, 200, {
      returnRefunds,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }, "Return & Refund records retrieved successfully");

  } catch (error) {
    return sendErrorResponse(res, 500, "GET_RETURN_REFUNDS_ERROR", error.message);
  }
};

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

export const updateReturnRefundStatus = async (req, res) => {
  try {
    const { status, remark } = req.body;

    const allowed = ["Pending", "Return_Approved", "Refund_Approved", "Rejected", "Completed"];
    if (!status || !allowed.includes(status)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Status must be one of: ${allowed.join(", ")}`);
    }

    const returnRefund = await ReturnRefund.findById(req.params.id);
    if (!returnRefund) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Return/Refund request not found");
    }

    returnRefund.status = status;
    if (remark) returnRefund.remark = remark;
    await returnRefund.save();

    if (status === "Return_Approved" || status === "Refund_Approved") {
      const orderNumber = returnRefund.items?.[0]?.orderNumber;
      const productIds  = returnRefund.items.map(i => i.productId?.toString()).filter(Boolean);

      if (productIds.length > 0) {
        const approvedStatus = status === "Refund_Approved" ? "REFUNDED" : "RETURNED";
        const bulkOrder = orderNumber
          ? await BulkOrder.findOne({ "orders.orderNumber": orderNumber })
          : null;

        if (bulkOrder) {
          for (const order of bulkOrder.orders) {
            for (const item of order.items) {
              if (productIds.includes(item.productId?.toString())) {
                item.itemStatus = approvedStatus;
              }
            }
          }
          await bulkOrder.save();
        }
      }
    }

    if (status === "Rejected") {
      const orderNumber = returnRefund.items?.[0]?.orderNumber;
      const productIds  = returnRefund.items.map(i => i.productId?.toString()).filter(Boolean);

      if (productIds.length > 0) {
        const bulkOrder = orderNumber
          ? await BulkOrder.findOne({ "orders.orderNumber": orderNumber })
          : null;

        if (bulkOrder) {
          for (const order of bulkOrder.orders) {
            for (const item of order.items) {
              if (productIds.includes(item.productId?.toString())) {
                item.itemStatus = "ACTIVE";
              }
            }
          }
          await bulkOrder.save();
        }
      }
    }

    return sendSuccessResponse(res, 200, { returnRefund }, `Request marked as ${status}`);

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_STATUS_ERROR", error.message);
  }
};


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
