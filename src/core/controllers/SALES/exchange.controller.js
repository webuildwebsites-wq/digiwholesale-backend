import mongoose from "mongoose";
import Exchange from "../../../models/SALES/Exchange.model.js";
import DigiProduct from "../../../models/Product/Product.model.js";
import Customer from "../../../models/Auth/Customer.js";
import { uploadReturnRefundFile } from "../../../Utils/uploads/returnRefund.upload.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import BulkOrder from "../../../models/order/BulkOrder.js";

const generateOrderNumber = () => `EX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

export const createExchange = async (req, res) => {
  try {
    const {
      name, phone, email,
      dateOfPurchase, itemType, condition, reasonForExchange,
      items,
      remark,
      OrderId,
      newItems,
      cgst,
      sgst,
    } = req.body;

    if (!name)             throw new Error("Customer name is required");
    if (!phone)            throw new Error("Phone number is required");
    if (!email)            throw new Error("Email is required");
    if (!dateOfPurchase)   throw new Error("Date of purchase is required");
    if (!itemType)         throw new Error("Item type is required");
    if (!condition)        throw new Error("Condition is required");
    if (!reasonForExchange) throw new Error("Reason for exchange is required");
    if (!OrderId)          throw new Error("Order id is required");

    if (!mongoose.Types.ObjectId.isValid(OrderId)) {
      return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid Order ID");
    }

    const bulkOrder = await BulkOrder.findById(OrderId);
    if (!bulkOrder) {
      return sendErrorResponse(res, 404, "ORDER_NOT_FOUND", "Order not found");
    }

    let parsedItems = items;
    if (typeof items === "string") parsedItems = JSON.parse(items);
    if (!parsedItems || !parsedItems.length) throw new Error("At least one item is required");

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

    const alreadyInProcess = [];
    for (const requestedItem of parsedItems) {
      if (!requestedItem.productId) continue;
      for (const order of bulkOrder.orders) {
        for (const item of order.items) {
          if (matchItem(item, requestedItem) && item.itemStatus && item.itemStatus !== "ACTIVE") {
            alreadyInProcess.push({ itemName: item.itemName, currentStatus: item.itemStatus });
          }
        }
      }
    }

    if (alreadyInProcess.length > 0) {
      const names = alreadyInProcess.map(i => `${i.itemName} (${i.currentStatus})`).join(", ");
      return sendErrorResponse(res, 400, "ITEMS_ALREADY_IN_PROCESS", `The following items are already in a process: ${names}`);
    }

    for (const requestedItem of parsedItems) {
      if (!requestedItem.productId) continue;
      for (const order of bulkOrder.orders) {
        for (const item of order.items) {
          if (matchItem(item, requestedItem)) {
            item.itemStatus = "EXCHANGE_REQUESTED";
          }
        }
      }
    }

    await bulkOrder.save();

    let photos = [];
    if (req.files && req.files.photos && req.files.photos.length > 0) {
      const uploadPromises = req.files.photos.map(f => uploadReturnRefundFile(f, "exchange/photos"));
      photos = await Promise.all(uploadPromises);
    }

    const enrichedItems = parsedItems.map((i) => ({
      ...i,
      category: (i.category || "").toUpperCase(),
      images: Array.isArray(i.images) ? i.images : [],
      orderNumber: bulkOrder.orders.find((o) =>
        o.items.some((it) =>
          it.productId.toString() === (i.productId || "").toString() &&
          (it.category || "").toUpperCase() === (i.category || "").toUpperCase()
        )
      )?.orderNumber || "",
    }));

    let newBulkOrderId = null;

    if (newItems && newItems.length > 0) {
      let parsedNewItems = newItems;
      if (typeof newItems === "string") parsedNewItems = JSON.parse(newItems);

      const productIds = parsedNewItems.map(i => i.productId).filter(Boolean);
      const products   = await DigiProduct.find({ _id: { $in: productIds } }).lean();
      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      const builtItems = parsedNewItems.map((item) => {
        const product = productMap.get(item.productId.toString());
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        return {
          productId:      product._id,
          orderType:      item.orderType || "STOCK",
          itemName:       item.itemName  || product.productName,
          category:       (item.category || product.category || "").toUpperCase(),
          code:           item.code      || product.productCode,
          brand:          item.brand     || product.brand,
          color:          item.color     || product.color,
          size:           item.size      || product.size,
          shape:          item.shape     || product.shape,
          dimensions:     item.dimensions|| product.dimensions,
          unit:           item.unit      || "PIECE",
          price:          item.price     ?? product.price ?? 0,
          mrp:            item.mrp       ?? product.mrp   ?? 0,
          gst:            item.gst       ?? product.gst   ?? 0,
          hsnSac:         item.hsnSac    || product.hsnSac,
          qty:            Number(item.qty) || 1,
          discountPercent:item.discountPercent || 0,
          discountAmount: item.discountAmount  || 0,
          itemStatus:     "ACTIVE",
        };
      });

      const customer = await Customer.findById(bulkOrder.customer.customerId).lean();

      const newBulkOrder = await BulkOrder.create({
        customer: {
          customerId:               bulkOrder.customer.customerId,
          customerName:             bulkOrder.customer.customerName,
          customerShipToId:         bulkOrder.customer.customerShipToId,
          customerShipToBranchName: bulkOrder.customer.customerShipToBranchName,
        },
        orders: [
          {
            orderNumber: generateOrderNumber(),
            items:       builtItems,
            cgst:        cgst ? String(cgst) : "0",
            sgst:        sgst ? String(sgst) : "0",
            status:      "Submitted",
          },
        ],
      });

      newBulkOrderId = newBulkOrder._id;
    }

    const exchange = await Exchange.create({
      OrderId,
      name:              name.trim().toUpperCase(),
      phone:             phone.trim(),
      email:             email?.trim(),
      dateOfPurchase:    new Date(dateOfPurchase),
      itemType,
      condition,
      reasonForExchange,
      items:             enrichedItems,
      photos,
      remark,
      newBulkOrderId,
      createdBy:         req.user._id,
      createdByName:     req.user.employeeName || req.user.name,
      tenantId:          req.user.tenantId,
    });

    return sendSuccessResponse(res, 201, { exchange }, "Exchange request created successfully");

  } catch (error) {
    console.error("Create Exchange Error:", error);
    return sendErrorResponse(res, 400, "CREATE_EXCHANGE_ERROR", error.message);
  }
};

export const selectNewProduct = async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    if (["Rejected", "Completed"].includes(exchange.status)) {
      return sendErrorResponse(res, 400, "INVALID_STATE", `Cannot update a ${exchange.status} exchange request`);
    }

    const { productId, remarks, priceDifferenceMode } = req.body;
    if (!productId) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "productId is required");
    }

    const product = await DigiProduct.findById(productId);
    if (!product) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Product not found in inventory");
    }

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

    const returnedTotal = exchange.items.reduce(
      (sum, i) => sum + i.amount * i.qty - (i.discount || 0),
      0
    );
    exchange.priceDifference = product.price - returnedTotal;

    if (priceDifferenceMode) exchange.priceDifferenceMode = priceDifferenceMode;

    await exchange.save();

    return sendSuccessResponse(res, 200, { exchange }, "New product attached to exchange request");

  } catch (error) {
    return sendErrorResponse(res, 400, "SELECT_PRODUCT_ERROR", error.message);
  }
};

export const getAllExchanges = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    filter.tenantId = req.user.tenantId;

    const [exchanges, total] = await Promise.all([
      Exchange.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Exchange.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccessResponse(res, 200, {
      exchanges,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }, "Exchanges retrieved successfully");

  } catch (error) {
    return sendErrorResponse(res, 500, "GET_EXCHANGES_ERROR", error.message);
  }
};

export const getExchangeById = async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }
    return sendSuccessResponse(res, 200, { exchange });
  } catch (error) {
    return sendErrorResponse(res, 400, "GET_EXCHANGE_ERROR", error.message);
  }
};

export const updateExchangeStatus = async (req, res) => {
  try {
    const { status, remark } = req.body;

    const allowed = ["Pending", "Approved", "Rejected", "Completed"];
    if (!status || !allowed.includes(status)) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Status must be one of: ${allowed.join(", ")}`);
    }

    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    exchange.status = status;
    if (remark) exchange.remark = remark;
    await exchange.save();

    if (status === "Approved") {
      const bulkOrder = await BulkOrder.findById(exchange.OrderId);
      if (bulkOrder) {
        const productIds = exchange.items.map(i => i.productId?.toString()).filter(Boolean);
        for (const order of bulkOrder.orders) {
          for (const item of order.items) {
            if (productIds.includes(item.productId?.toString())) {
              item.itemStatus = "EXCHANGED";
            }
          }
        }
        await bulkOrder.save();
      }
    }

    if (status === "Rejected") {
      const bulkOrder = await BulkOrder.findById(exchange.OrderId);
      if (bulkOrder) {
        const productIds = exchange.items.map(i => i.productId?.toString()).filter(Boolean);
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

    return sendSuccessResponse(res, 200, { exchange }, `Exchange marked as ${status}`);

  } catch (error) {
    return sendErrorResponse(res, 400, "UPDATE_STATUS_ERROR", error.message);
  }
};

export const updateExchange = async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }

    if (["Approved", "Completed"].includes(exchange.status)) {
      return sendErrorResponse(res, 400, "INVALID_STATE", `Cannot edit a ${exchange.status} exchange request`);
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

export const deleteExchange = async (req, res) => {
  try {
    const exchange = await Exchange.findByIdAndDelete(req.params.id);
    if (!exchange) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Exchange request not found");
    }
    return sendSuccessResponse(res, 200, null, "Exchange request deleted successfully");
  } catch (error) {
    return sendErrorResponse(res, 400, "DELETE_EXCHANGE_ERROR", error.message);
  }
};

export const filterExchanges = async (req, res) => {
  try {
    const { startDate, endDate, keyword, status } = req.body;

    if (!startDate && !keyword && !status) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Date range, keyword, or status is required");
    }

    let query = { tenantId: req.user.tenantId };

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

    return sendSuccessResponse(res, 200, { total: exchanges.length, exchanges });

  } catch (error) {
    console.error("Filter Exchange Error:", error);
    return sendErrorResponse(res, 500, "FILTER_EXCHANGE_ERROR", error.message);
  }
};
