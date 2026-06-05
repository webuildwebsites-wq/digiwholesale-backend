import mongoose from "mongoose";
import Exchange from "../../../models/SALES/Exchange.model.js";
import DigiProduct from "../../../models/Product/Product.model.js";
import { uploadReturnRefundFile } from "../../../Utils/uploads/returnRefund.upload.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

/* =====================================================
   CREATE EXCHANGE REQUEST  (Step 1)
===================================================== */
export const createExchange = async (req, res) => {
  try {
    const { storeId, storeNumber } = req.user;

    const {
      name, phone, email,
      dateOfPurchase, itemType, condition, reasonForExchange,
      items,
      priceDifference, priceDifferenceMode,
      remark,
    } = req.body;

    // ── Validate required fields ──────────────────
    if (!name)              throw new Error("Customer name is required");
    if (!phone)             throw new Error("Phone number is required");
    if (!dateOfPurchase)    throw new Error("Date of purchase is required");
    if (!itemType)          throw new Error("Item type is required");
    if (!condition)         throw new Error("Condition is required");
    if (!reasonForExchange) throw new Error("Reason for exchange is required");

    // ── Parse items (JSON string when sent via FormData) ──
    let parsedItems = items;
    if (typeof items === "string") parsedItems = JSON.parse(items);
    if (!parsedItems || !parsedItems.length) {
      throw new Error("At least one item is required");
    }

    // ── Upload photos ─────────────────────────────
    let photos = [];
    if (req.files && req.files.photos && req.files.photos.length > 0) {
      const uploadPromises = req.files.photos.map((file) =>
        uploadReturnRefundFile(file, "exchange/photos")
      );
      photos = await Promise.all(uploadPromises);
    }

    const exchange = await Exchange.create({
      storeId,
      storeNumber,
      name: name.trim().toUpperCase(),
      phone: phone.trim(),
      email: email?.trim(),
      dateOfPurchase: new Date(dateOfPurchase),
      itemType,
      condition,
      reasonForExchange,
      items: parsedItems,
      newProduct: null,         // filled in Step 2
      priceDifference: Number(priceDifference) || 0,
      priceDifferenceMode: priceDifferenceMode || "NIL",
      photos,
      remark,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    return sendSuccessResponse(res, 201, { exchange }, "Exchange request created successfully");

  } catch (error) {
    console.error("Create Exchange Error:", error);
    return sendErrorResponse(res, 400, "CREATE_EXCHANGE_ERROR", error.message);
  }
};

/* =====================================================
   SELECT NEW PRODUCT  (Step 2 — "Select Product" button)

   Staff searches product via GET /api/digi/product/suggestion?q=...
   Frontend sends back the chosen DigiProduct's _id here.

   Body: {
     productId: "DigiProduct _id",
     remarks: "optional note",
     priceDifferenceMode: "CASH" | "CARD" | "UPI" | "NIL"
   }

   priceDifference is AUTO-CALCULATED:
     newProduct.price  −  sum(items amount×qty − discount)
===================================================== */
export const selectNewProduct = async (req, res) => {
  try {
    const exchange = await Exchange.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    if (["Rejected", "Completed"].includes(exchange.status)) {
      return sendErrorResponse(
        res, 400, "INVALID_STATE",
        `Cannot update a ${exchange.status} exchange request`
      );
    }

    const { productId, remarks, priceDifferenceMode } = req.body;

    if (!productId) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "productId is required");
    }

    // ── Fetch product from DigiProduct collection ─
    const product = await DigiProduct.findById(productId);
    if (!product) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Product not found in inventory");
    }

    // ── Snapshot product details onto exchange ────
    exchange.newProduct = {
      productId:   product._id,
      productCode: product.productCode,
      productName: product.productName,
      category:    product.category,
      brand:       product.brand,
      coating:     product.coating,
      index:       product.index,
      price:       product.price,
      mrp:         product.mrp,
      remarks:     remarks || "",
    };

    // ── Auto-calculate price difference ───────────
    // returnedTotal = (amount × qty) − discount  per item
    const returnedTotal = exchange.items.reduce(
      (sum, i) => sum + i.amount * i.qty - (i.discount || 0),
      0
    );
    // positive → customer pays extra | negative → store refunds
    exchange.priceDifference = product.price - returnedTotal;

    if (priceDifferenceMode) {
      exchange.priceDifferenceMode = priceDifferenceMode;
    }

    await exchange.save();

    return sendSuccessResponse(res, 200, { exchange }, "New product attached to exchange request");

  } catch (error) {
    return sendErrorResponse(res, 400, "SELECT_PRODUCT_ERROR", error.message);
  }
};

/* =====================================================
   GET ALL EXCHANGE REQUESTS (PAGINATED)
===================================================== */
export const getAllExchanges = async (req, res) => {
  try {
    const { storeId } = req.user;

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const filter = { storeId };
    if (req.query.status) filter.status = req.query.status;

    const [exchanges, total] = await Promise.all([
      Exchange.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Exchange.countDocuments(filter),
    ]);

    return sendSuccessResponse(res, 200, {
      page,
      limit,
      total,
      count: exchanges.length,
      hasMore: skip + exchanges.length < total,
      exchanges,
    });

  } catch (error) {
    return sendErrorResponse(res, 500, "GET_EXCHANGES_ERROR", error.message);
  }
};

/* =====================================================
   GET SINGLE EXCHANGE REQUEST
===================================================== */
export const getExchangeById = async (req, res) => {
  try {
    const exchange = await Exchange.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    return sendSuccessResponse(res, 200, { exchange });

  } catch (error) {
    return sendErrorResponse(res, 400, "GET_EXCHANGE_ERROR", error.message);
  }
};

/* =====================================================
   UPDATE STATUS  (Approve / Reject / Complete)
===================================================== */
export const updateExchangeStatus = async (req, res) => {
  try {
    const { status, remark } = req.body;

    const allowed = ["Pending", "Approved", "Rejected", "Completed"];
    if (!status || !allowed.includes(status)) {
      return sendErrorResponse(
        res, 400, "VALIDATION_ERROR",
        `Status must be one of: ${allowed.join(", ")}`
      );
    }

    const exchange = await Exchange.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    exchange.status = status;
    if (remark) exchange.remark = remark;
    await exchange.save();

    return sendSuccessResponse(res, 200, { exchange }, `Exchange marked as ${status}`);

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_STATUS_ERROR", error.message);
  }
};

/* =====================================================
   UPDATE EXCHANGE REQUEST (full edit — Pending only)
===================================================== */
export const updateExchange = async (req, res) => {
  try {
    const exchange = await Exchange.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    if (["Approved", "Completed"].includes(exchange.status)) {
      return sendErrorResponse(
        res, 400, "INVALID_STATE",
        `Cannot edit a ${exchange.status} exchange request`
      );
    }

    const editableFields = [
      "name", "phone", "email",
      "dateOfPurchase", "itemType", "condition", "reasonForExchange",
      "items", "priceDifference", "priceDifferenceMode", "remark",
    ];

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) exchange[field] = req.body[field];
    });

    await exchange.save();

    return sendSuccessResponse(res, 200, { exchange }, "Exchange request updated successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_EXCHANGE_ERROR", error.message);
  }
};

/* =====================================================
   DELETE EXCHANGE REQUEST
===================================================== */
export const deleteExchange = async (req, res) => {
  try {
    const exchange = await Exchange.findOneAndDelete({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    return sendSuccessResponse(res, 200, null, "Exchange request deleted successfully");

  } catch (error) {
    return sendErrorResponse(res, 400, "DELETE_EXCHANGE_ERROR", error.message);
  }
};

/* =====================================================
   FILTER / SEARCH EXCHANGES
===================================================== */
export const filterExchanges = async (req, res) => {
  try {
    const { storeId } = req.user;
    const { startDate, endDate, keyword, status } = req.body;

    if (!startDate && !keyword && !status) {
      return sendErrorResponse(
        res, 400, "VALIDATION_ERROR",
        "Date range, keyword, or status is required"
      );
    }

    let query = { storeId: new mongoose.Types.ObjectId(storeId) };

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
        { reasonForExchange: regex },
        { "items.item": regex },
        { "newProduct.productName": regex },
        { "newProduct.brand": regex },
      ];
    }

    const exchanges = await Exchange.find(query).sort({ createdAt: -1 });

    if (!exchanges.length) {
      return sendErrorResponse(res, 200, "NO_DATA", "No records found with this filter");
    }

    return sendSuccessResponse(res, 200, {
      total: exchanges.length,
      exchanges,
    });

  } catch (error) {
    console.error("Filter Exchange Error:", error);
    return sendErrorResponse(res, 500, "FILTER_EXCHANGE_ERROR", error.message);
  }
};
