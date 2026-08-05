import mongoose from "mongoose";
import Order from "../../../models/order/customer.order.js";
import Customer from "../../../models/Auth/Customer.js";
import Tint from "../../../models/order/Tint.js";
import FrameType from "../../../models/order/FrameType.js";
import ProductTreatment from "../../../models/order/ProductTreatment.js";
import ProductType from "../../../models/order/ProductType.js";
import DigiProduct from "../../../models/Product/Product.model.js";
import BulkOrder from "../../../models/order/BulkOrder.js";
import { invalidatePDFs } from "../pdfStorageService.js";


export async function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = "BO-" + dateStr + "-";

  const last = await BulkOrder.findOne(
    { "orders.orderNumber": { $regex: "^" + prefix } },
    { "orders.orderNumber": 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let seq = 1;
  if (last?.orders?.length) {
    const nums = last.orders
      .map((o) => o.orderNumber)
      .filter((n) => n?.startsWith(prefix))
      .map((n) => parseInt(n.split("-").pop(), 10))
      .filter((n) => !isNaN(n));
    if (nums.length) seq = Math.max(...nums) + 1;
  }

  return prefix + String(seq).padStart(4, "0");
}


async function resolveDiigProductField(fieldKey, value, fieldLabel) {
  if (!value) return null;

  if (typeof value === "object" && value.id) {
    const doc = await DigiProduct.findById(value.id).lean();
    if (!doc) throw { statusCode: 404, code: "NOT_FOUND", message: `${fieldLabel} with id "${value.id}" not found in products` };
    return { id: doc._id, name: doc[fieldKey] };
  }

  if (typeof value === "string") {
    const doc = await DigiProduct.findOne({
      [fieldKey]: { $regex: `^${value.trim()}$`, $options: "i" },
    }).lean();
    if (!doc) throw { statusCode: 404, code: "NOT_FOUND", message: `${fieldLabel} "${value}" not found in products` };
    return { id: doc._id, name: doc[fieldKey] };
  }

  return null;
}

async function resolveProductNameField(value) {
  if (!value) return null;

  let doc;
  if (typeof value === "object" && value.id) {
    doc = await DigiProduct.findById(value.id).lean();
    if (!doc) throw { statusCode: 404, code: "NOT_FOUND", message: `Product with id "${value.id}" not found in products` };
  } else if (typeof value === "string") {
    doc = await DigiProduct.findOne({
      productName: { $regex: `^${value.trim()}$`, $options: "i" },
    }).lean();
    if (!doc) throw { statusCode: 404, code: "NOT_FOUND", message: `Product "${value}" not found in products` };
  } else {
    return null;
  }

  return { id: doc._id, name: doc.productName, price: doc.price ?? 0 };
}

async function resolveDropdownField(Model, value, fieldLabel, nameField = "name") {
  if (!value) return null;

  if (typeof value === "object" && value.id) {
    const doc = await Model.findById(value.id).lean();
    if (!doc) throw { statusCode: 404, code: "NOT_FOUND", message: `${fieldLabel} with id "${value.id}" not found` };
    return { id: doc._id, name: doc[nameField] };
  }

  if (typeof value === "string") {
    const doc = await Model.findOne({
      [nameField]: { $regex: `^${value.trim()}$`, $options: "i" },
    }).lean();
    if (!doc) throw { statusCode: 404, code: "NOT_FOUND", message: `${fieldLabel} "${value}" not found` };
    return { id: doc._id, name: doc[nameField] };
  }

  return null;
}


function sanitizeFitting(fitting) {
  if (!fitting) return fitting;
  if (!fitting.hasFlatFitting) return { hasFlatFitting: false };

  const missing = [];
  if (fitting.dbl == null) missing.push("fitting.dbl (DBL)");
  if (!fitting.frameType) missing.push("fitting.frameType (Frame Type)");
  if (fitting.frameLength == null) missing.push("fitting.frameLength (Frame Length)");
  if (fitting.frameHeight == null) missing.push("fitting.frameHeight (Frame Height)");

  if (missing.length) {
    throw { statusCode: 400, code: "MISSING_FIELDS", message: `Fitting data required when hasFlatFitting is true: ${missing.join(", ")}` };
  }
  return fitting;
}

export async function getOrderService(orderId, tenantId) {
  const filter = { _id: orderId };
  if (tenantId) filter.tenantId = tenantId;
  const order = await BulkOrder.findOne(filter);
  if (!order) throw { statusCode: 404, code: "NOT_FOUND", message: "Order not found" };
  return order;
}

export async function deleteOrderService(orderId, tenantId) {
  const filter = { _id: orderId };
  if (tenantId) filter.tenantId = tenantId;
  const order = await Order.findOne(filter);
  if (!order) throw { statusCode: 404, code: "NOT_FOUND", message: "Order not found" };
  if (!["Draft", "Cancelled"].includes(order.status)) {
    throw { statusCode: 400, code: "INVALID_STATUS", message: `Cannot delete an order with status "${order.status}". Only Draft or Cancelled orders can be deleted.` };
  }
  await Order.findOneAndDelete(filter);
}

export async function listOrdersService({ customerId, status, page = 1, limit = 20, search, fromDate, toDate, tenantId }) {
  const STATUS_MAP = {
    PENDING: ["Processing"],
    CONFIRMED: ["Confirmed"],
    PROCESSING: ["Processing"],
    COMPLETED: ["Completed"],
    CANCELLED: ["Cancelled"],
    SUBMITTED: ["Submitted"],
    DRAFT: ["Draft"],
    DELIVERABLE: ["Deliverable"],
  };
  const filter = {};
  if (tenantId) filter.tenantId = tenantId;
  if (customerId) filter["customer.customerId"] = customerId;

  if (status) {
    const key = status.toUpperCase();
    if (!STATUS_MAP[key]) {
      throw { statusCode: 400, code: "INVALID_VALUE", message: `Invalid status. Allowed: ${Object.keys(STATUS_MAP).join(", ")}` };
    }
    filter["orders"] = { $elemMatch: { status: { $in: STATUS_MAP[key] } } };
  }

  if (search && search.trim()) {
    const searchRegex = { $regex: search.trim(), $options: "i" };

    const matchedCustomers = await Customer.find({
      ...(tenantId ? { tenantId } : {}),
      $or: [
        { shopName: searchRegex },
        { ownerName: searchRegex },
        { businessEmail: searchRegex },
        { mobileNo1: searchRegex },
        { mobileNo2: searchRegex },
        { customerCode: searchRegex },
      ],
    }).select("_id").lean();

    const customerIds = matchedCustomers.map(c => c._id);

    filter.$or = [
      { "customer.customerName": searchRegex },
      { "orders.orderNumber": searchRegex },
      { "orders.items.itemName": searchRegex },
      ...(customerIds.length > 0 ? [{ "customer.customerId": { $in: customerIds } }] : []),
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

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await BulkOrder.countDocuments(filter);
  const orders = await BulkOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const customerIds = [...new Set(orders.map(o => o.customer?.customerId?.toString()).filter(Boolean))];
  const customers = await Customer.find({ _id: { $in: customerIds }, ...(filter.tenantId ? { tenantId: filter.tenantId } : {}) })
    .select("_id billingMode billingCycle")
    .lean();
  const customerMap = new Map(customers.map(c => [c._id.toString(), c]));

  const ordersWithTotalPrice = orders.map((bulkOrder) => {
    const custId = bulkOrder.customer?.customerId?.toString();
    const custData = custId ? customerMap.get(custId) : null;

    return {
      ...bulkOrder,
      customer: {
        ...bulkOrder.customer,
        billingMode: custData?.billingMode || null,
        billingCycle: custData?.billingCycle || null,
      },
      orders: bulkOrder.orders.map((order) => ({
        ...order,
        totalOrderPrice: Number(
          order.items
            .reduce((sum, item) => {
              const price = Number(item.price || 0);
              const gstPercent = Number(item.gst || 0);
              return sum + price + (price * gstPercent) / 100;
            }, 0)
            .toFixed(2),
        ),
      })),
    };
  });

  return {
    orders: ordersWithTotalPrice,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

export async function cancelOrderService(orderId, reason, tenantId, user = {}) {
  const ALLOWED_TRANSITIONS = {
    "Draft":           ["Submitted", "Cancelled"],
    "Submitted":       ["Processing", "Cancelled"],
    "Processing":      ["QC", "Cancelled"],
    "QC":              ["ReadyToDispatch", "Cancelled"],
    "ReadyToDispatch": ["Dispatched", "Cancelled"],
    "Dispatched":      ["Delivered", "Cancelled"],
    "Delivered":       ["Completed"],
    "Completed":       [],
    "Cancelled":       [],
  };

  const filter = { _id: orderId };
  if (tenantId) filter.tenantId = tenantId;

  const bulkOrder = await BulkOrder.findOne(filter);
  if (!bulkOrder) throw { statusCode: 404, code: "NOT_FOUND", message: "Order not found" };

  for (const order of bulkOrder.orders) {
    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes("Cancelled")) {
      throw {
        statusCode: 400,
        code: "INVALID_TRANSITION",
        message: `Order "${order.orderNumber}" cannot be cancelled from status "${order.status}". Allowed next: ${allowed.length ? allowed.join(", ") : "none"}`,
      };
    }

    order.statusHistory.push({
      from:          order.status,
      to:            "Cancelled",
      remarks:       reason || "",
      changedBy:     user._id     || user.id || null,
      changedByName: user.employeeName || user.name || "",
      changedAt:     new Date(),
    });

    order.status  = "Cancelled";
    order.remarks = reason || order.remarks || null;
  }

  await bulkOrder.save();

  invalidatePDFs(orderId, tenantId).catch(err => console.error("PDF invalidation error (cancel):", err.message));

  return bulkOrder;
}

export async function updateDraftOrderService(orderId, data, tenantId) {
  const filter = { _id: orderId };
  if (tenantId) filter.tenantId = tenantId;
  const order = await BulkOrder.findOne(filter);
  if (!order) throw { statusCode: 404, code: "NOT_FOUND", message: "Order not found" };

  const canUpdate = order.orders.every(o => ["Draft", "Submitted"].includes(o.status));
  if (!canUpdate) {
    throw { statusCode: 400, code: "INVALID_STATUS", message: "Only Draft or Submitted orders can be updated Anish" };
  }

  if (data.fitting !== undefined) data.fitting = sanitizeFitting(data.fitting);

  if (data.brand) data.brand = await resolveDiigProductField("brand", data.brand, "Brand");
  if (data.category) data.category = await resolveDiigProductField("category", data.category, "Category");
  if (data.coating) data.coating = await resolveDiigProductField("coating", data.coating, "Coating");
  if (data.productName) data.productName = await resolveProductNameField(data.productName);
  if (data.treatment) data.treatment = await resolveDropdownField(ProductTreatment, data.treatment, "Treatment");
  if (data.tint) data.tint = await resolveDropdownField(Tint, data.tint, "Tint");

  const brand = (data.brand || order.brand)?.name;
  const category = (data.category || order.category)?.name;
  const productName = (data.productName || order.productName)?.name;
  const productMode = data.productMode || order.productMode;
  const powerType = data.powerType || order.powerType;
  const powers = data.powers || order.powers;

  if (data.status === "Submitted") {
    const submitMissing = [];
    if (!brand) submitMissing.push("brand");
    if (!category) submitMissing.push("category");
    if (!productName) submitMissing.push("productName");
    if (!productMode) submitMissing.push("productMode");
    if (!powerType) submitMissing.push("powerType");
    if (!powers?.length) submitMissing.push("powers (at least one eye required)");

    const coating = (data.coating || order.coating)?.name;
    const treatment = (data.treatment || order.treatment)?.name;
    const tint = (data.tint || order.tint)?.name;
    const index = data.index ?? order.index;

    if (!coating) submitMissing.push("coating");
    if (index == null) submitMissing.push("index");
    if (!tint) submitMissing.push("tint");
    if (!treatment) submitMissing.push("treatment");

    if (submitMissing.length) {
      throw { statusCode: 400, code: "MISSING_FIELDS", message: `Missing required fields for submission: ${submitMissing.join(", ")}` };
    }

    sanitizeFitting(data.fitting ?? order.fitting);

    if (!["Stock Lens", "Rx"].includes(productMode)) {
      throw { statusCode: 400, code: "INVALID_VALUE", message: `productMode must be "Stock Lens" or "Rx"` };
    }
    if (!["Single", "Both"].includes(powerType)) {
      throw { statusCode: 400, code: "INVALID_VALUE", message: `powerType must be "Single" or "Both"` };
    }
    for (const p of powers) {
      if (!["R", "L"].includes(p.side)) {
        throw { statusCode: 400, code: "INVALID_VALUE", message: `powers[].side must be "R" or "L"` };
      }
      if (p.sph == null) {
        throw { statusCode: 400, code: "MISSING_FIELDS", message: `powers[].sph is required for side "${p.side}"` };
      }
    }
    if (powerType === "Both") {
      const sides = powers.map((p) => p.side);
      if (!sides.includes("R") || !sides.includes("L")) {
        throw { statusCode: 400, code: "MISSING_FIELDS", message: `powerType is "Both" but powers must include both "R" and "L" sides` };
      }
    }
    data.submittedAt = new Date();
  }

  if (data.customer) {
    if (data.customer.customerId) {
      const customer = await Customer.findOne({ _id: data.customer.customerId, ...(tenantId ? { tenantId } : {}) }).lean();
      if (!customer) throw { statusCode: 404, code: "NOT_FOUND", message: "Customer not found" };

      let customerShipToBranchName = order.customer.customerShipToBranchName;
      const shipToId = data.customer.customerShipToId || order.customer.customerShipToId;
      if (shipToId) {
        const shipTo = (customer.customerShipToDetails || []).find(
          (s) => s._id.toString() === shipToId.toString()
        );
        if (!shipTo) throw { statusCode: 404, code: "NOT_FOUND", message: "Ship-to address not found for this customer" };
        customerShipToBranchName = shipTo.branchName;
      }
      order.customer = {
        customerId: customer._id,
        customerName: customer.shopName,
        customerShipToId: shipToId ?? null,
        customerShipToBranchName: customerShipToBranchName,
      };
    } else if (data.customer.customerShipToId) {
      const customer = await Customer.findOne({ _id: order.customer.customerId, ...(tenantId ? { tenantId } : {}) }).lean();
      const shipTo = (customer?.customerShipToDetails || []).find(
        (s) => s._id.toString() === data.customer.customerShipToId.toString()
      );
      if (!shipTo) throw { statusCode: 404, code: "NOT_FOUND", message: "Ship-to address not found for this customer" };
      order.customer.customerShipToId = data.customer.customerShipToId;
      order.customer.customerShipToBranchName = shipTo.branchName;
    }
  }

  const UPDATABLE = [
    "lab", "orderReference", "consumerCardName", "opticianName",
    "powerType", "productMode", "hasPrism", "powers", "prisms",
    "brand", "category", "index", "productName", "coating", "treatment",
    "tint", "tintDetails", "remarks", "mirror", "resolved", "suppliers",
    "centration", "fitting", "lensData",
    "directCustomer", "shippingCharges", "otherCharges", "status",
  ];
  UPDATABLE.forEach((key) => { if (data[key] !== undefined) order[key] = data[key]; });

  // price is always derived from the resolved productName, never from frontend
  const resolvedPrice = (data.productName || order.productName)?.price ?? 0;
  order.price = resolvedPrice;
  order.totalOrderPrice = resolvedPrice + (order.shippingCharges ?? 0) + (order.otherCharges ?? 0);

  await order.save();
  return order;
}

export async function getTintOptionsService() {
  return await Tint.find({}).sort({ name: 1 }).lean();
}

export async function getFrameTypesService() {
  return await FrameType.find({}).sort({ name: 1 }).lean();
}

export async function getProductBrandsService({ tenantId } = {}) {
  const match = { brand: { $nin: [null, ""] } };
  if (tenantId) match.tenantId = tenantId;

  return await DigiProduct.aggregate([
    { $match: match },
    { $sort: { brand: 1, createdAt: 1 } },
    {
      $group: {
        _id: "$brand",
        docId: { $first: "$_id" },
        name: { $first: "$brand" },
        __v: { $first: "$__v" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
      },
    },
    { $sort: { name: 1 } },
    {
      $project: {
        _id: "$docId",
        name: 1,
        __v: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
}

export async function getProductCategoriesService({ brand, tenantId } = {}) {
  const match = { category: { $nin: [null, ""] } };
  if (tenantId) match.tenantId = tenantId;
  if (brand?.trim()) match.brand = { $regex: `^${brand.trim()}$`, $options: "i" };

  return await DigiProduct.aggregate([
    { $match: match },
    { $sort: { category: 1, createdAt: 1 } },
    {
      $group: {
        _id: "$category",
        docId: { $first: "$_id" },
        name: { $first: "$category" },
        __v: { $first: "$__v" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
      },
    },
    { $sort: { name: 1 } },
    {
      $project: {
        _id: "$docId",
        name: 1,
        __v: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
}

export async function getProductCoatingsService({ brand, category, tenantId } = {}) {
  const match = { coating: { $nin: [null, ""] } };
  if (tenantId) match.tenantId = tenantId;
  if (brand?.trim()) match.brand = { $regex: `^${brand.trim()}$`, $options: "i" };
  if (category?.trim()) match.category = { $regex: `^${category.trim()}$`, $options: "i" };

  return await DigiProduct.aggregate([
    { $match: match },
    { $sort: { coating: 1, createdAt: 1 } },
    {
      $group: {
        _id: "$coating",
        docId: { $first: "$_id" },
        name: { $first: "$coating" },
        __v: { $first: "$__v" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
      },
    },
    { $sort: { name: 1 } },
    {
      $project: {
        _id: "$docId",
        name: 1,
        __v: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
}

export async function getProductNamesService({ brand, category, search = "", limit = 100, page = 1, tenantId } = {}) {
  const filter = { productName: { $nin: [null, ""] } };
  if (tenantId) filter.tenantId = tenantId;
  if (brand?.trim()) filter.brand = { $regex: `^${brand.trim()}$`, $options: "i" };
  if (category?.trim()) filter.category = { $regex: `^${category.trim()}$`, $options: "i" };
  if (search.trim()) filter.productName = { $regex: search.trim(), $options: "i" };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await DigiProduct.countDocuments(filter);

  const data = await DigiProduct.find(filter, {
    _id: 1, productName: 1, brand: 1, category: 1, coating: 1,
    price: 1, mrp: 1, gst: 1, qty: 1, createdAt: 1, updatedAt: 1, __v: 1,
  }).sort({ productName: 1 }).skip(skip).limit(parseInt(limit)).lean();

  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

export async function getProductTreatmentsService() {
  return await ProductTreatment.find({}).sort({ name: 1 }).lean();
}

export async function getProductTypesService() {
  return await ProductType.find({}).sort({ name: 1 }).lean();
}

export async function getProductIndexesService({ tenantId } = {}) {
  const match = { index: { $nin: [null, ""] } };
  if (tenantId) match.tenantId = tenantId;

  return await DigiProduct.aggregate([
    { $match: match },
    { $sort: { index: 1, createdAt: 1 } },
    {
      $group: {
        _id: "$index",
        docId: { $first: "$_id" },
        value: { $first: { $toDouble: "$index" } },
        __v: { $first: "$__v" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
      },
    },
    { $sort: { value: 1 } },
    {
      $project: {
        _id: "$docId",
        value: 1,
        __v: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
}

export async function suggestionsOrdersService({ search, limit = 10, tenantId }) {
  const filter = {};
  if (tenantId) filter.tenantId = tenantId;

  if (search && search.trim()) {
    const regex = { $regex: search.trim(), $options: "i" };
    filter.$or = [
      { "orders.orderNumber": regex },
      { "orders.items.orderType": regex },
      { "customer.customerName": regex },
    ];

    if (mongoose.Types.ObjectId.isValid(search.trim())) {
      filter.$or.push({ _id: new mongoose.Types.ObjectId(search.trim()) });
    }
  }

  const orders = await BulkOrder.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  const ordersWithTotalPrice = orders.map((bulkOrder) => ({
    ...bulkOrder,
    orders: bulkOrder.orders.map((order) => ({
      ...order,
      totalOrderPrice: Number(
        order.items
          .reduce((sum, item) => {
            const price = Number(item.price || 0);
            const gstPercent = Number(item.gst || 0);
            return sum + price + (price * gstPercent) / 100;
          }, 0)
          .toFixed(2)
      ),
    })),
  }));

  return ordersWithTotalPrice;
}

export async function getRxOrdersService({ page = 1, limit = 20, search, fromDate, toDate, vendorId, customerId, tenantId }) {
  const filter = {
    "orders.items.orderType": "RX",
  };
  if (tenantId) filter.tenantId = tenantId;

  if (customerId) filter["customer.customerId"] = customerId;

  if (vendorId) filter["orders.items.rx.vendor.id"] = vendorId;

  if (search && search.trim()) {
    const regex = { $regex: search.trim(), $options: "i" };
    filter.$or = [
      { "orders.orderNumber": regex },
      { "customer.customerName": regex },
      { "orders.items.itemName": regex },
      { "orders.items.rx.vendor.name": regex },
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

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await BulkOrder.countDocuments(filter);
  const records = await BulkOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const orders = records.map((bulkOrder) => ({
    ...bulkOrder,
    orders: bulkOrder.orders.map((order) => ({
      ...order,
      rxItems: order.items.filter((item) => item.orderType === "RX"),
      totalOrderPrice: Number(
        order.items
          .filter((item) => item.orderType === "RX")
          .reduce((sum, item) => {
            const price = Number(item.price || 0);
            const gstPercent = Number(item.gst || 0);
            return sum + price + (price * gstPercent) / 100;
          }, 0)
          .toFixed(2)
      ),
    })),
  }));

  return {
    orders,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

export async function getDraftOrdersService({ page = 1, limit = 20, search, customerId, fromDate, toDate, tenantId }) {
  const filter = {
    "orders": { $elemMatch: { status: "Draft" } },
  };
  if (tenantId) filter.tenantId = tenantId;

  if (customerId) filter["customer.customerId"] = customerId;

  if (search && search.trim()) {
    const regex = { $regex: search.trim(), $options: "i" };
    filter.$or = [
      { "orders.orderNumber": regex },
      { "customer.customerName": regex },
      { "orders.items.itemName": regex },
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

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await BulkOrder.countDocuments(filter);

  const records = await BulkOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const orders = records.map((bulkOrder) => ({
    ...bulkOrder,
    orders: bulkOrder.orders
      .filter(o => o.status === "Draft")
      .map(order => ({
        ...order,
        totalOrderPrice: Number(
          order.items
            .reduce((sum, item) => {
              const price = Number(item.price || 0);
              const gstPercent = Number(item.gst || 0);
              return sum + price + (price * gstPercent) / 100;
            }, 0)
            .toFixed(2)
        ),
      })),
  }));

  return {
    orders,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}
