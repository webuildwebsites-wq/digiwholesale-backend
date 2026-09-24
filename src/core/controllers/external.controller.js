import Tenant        from "../../models/Tenant/Tenant.model.js";
import ExternalOrder from "../../models/ExternalOrder.model.js";
import Counter       from "../../models/Auth/Counter.js";

class InputValidationError extends Error {
  constructor(message, field = "") {
    super(message);
    this.name = "InputValidationError";
    this.field = field;
  }
}

const parseNumber = (val, defaultVal = 0, fieldName = "number") => {
  if (val === undefined || val === null || val === "") {
    return defaultVal;
  }
  if (typeof val === "number") {
    if (isNaN(val)) {
      throw new InputValidationError(`Field '${fieldName}' must be a valid number, received: NaN.`, fieldName);
    }
    return val;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[₹$,]/g, "").trim();
    if (cleaned === "" || cleaned.toLowerCase() === "null" || cleaned.toLowerCase() === "undefined") {
      return defaultVal;
    }
    const num = Number(cleaned);
    if (isNaN(num)) {
      throw new InputValidationError(`Field '${fieldName}' must be a valid number, received: "${val}".`, fieldName);
    }
    return num;
  }
  const num = Number(val);
  if (isNaN(num)) {
    throw new InputValidationError(`Field '${fieldName}' must be a valid number, received: "${val}".`, fieldName);
  }
  return num;
};

const parseNullableNumber = (val, fieldName = "number") => {
  if (val === undefined || val === null || val === "") {
    return null;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[₹$,]/g, "").trim();
    const upper = cleaned.toUpperCase();
    if (upper === "PLANO" || upper === "PLAN" || upper === "PL") {
      return 0;
    }
    if (upper === "N/A" || upper === "NA" || upper === "NONE" || upper === "---" || upper === "NULL" || upper === "UNDEFINED") {
      return null;
    }
    const num = Number(cleaned);
    if (isNaN(num)) {
      throw new InputValidationError(`Field '${fieldName}' must be a valid numeric value or null, received: "${val}".`, fieldName);
    }
    return num;
  }
  if (typeof val === "number") {
    if (isNaN(val)) return null;
    return val;
  }
  const num = Number(val);
  if (isNaN(num)) {
    throw new InputValidationError(`Field '${fieldName}' must be a valid number, received: "${val}".`, fieldName);
  }
  return num;
};

const parseDate = (val, fieldName = "date") => {
  if (!val || val === "---" || val === "N/A" || val === "null" || val === "undefined") {
    return null;
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      throw new InputValidationError(`Field '${fieldName}' contains an invalid date.`, fieldName);
    }
    return val;
  }
  if (typeof val === "string" || typeof val === "number") {
    const str = String(val).trim();
    if (!str) return null;

    const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const d = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
      if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) {
      throw new InputValidationError(`Field '${fieldName}' must be a valid date (e.g. "YYYY-MM-DD" or ISO string), received: "${val}".`, fieldName);
    }
    return parsed;
  }
  throw new InputValidationError(`Field '${fieldName}' must be a valid date, received: "${val}".`, fieldName);
};


const parseSide = (val) => {
  if (!val) return undefined;
  const s = String(val).trim().toUpperCase();
  if (s === "R" || s === "RIGHT" || s.startsWith("R")) return "R";
  if (s === "L" || s === "LEFT" || s.startsWith("L")) return "L";
  return undefined;
};

const handleExternalError = (res, error, context = "") => {
  console.error(`[External API Error] ${context}:`, error);

  // Custom Input Validation Error
  if (error.name === "InputValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
      field: error.field || undefined,
    });
  }

  // Mongoose Schema ValidationError
  if (error.name === "ValidationError" && error.errors) {
    const errorDetails = Object.entries(error.errors).map(([field, err]) => ({
      field,
      message: err.message,
      value: err.value,
      kind: err.kind,
    }));
    const message = errorDetails.map((e) => `${e.field}: ${e.message}`).join("; ");
    return res.status(400).json({
      success: false,
      message: `Validation Error: ${message}`,
      errors: errorDetails,
    });
  }

  // Mongoose CastError (e.g. invalid type for number, date, or ObjectId)
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid data format for field '${error.path}': expected ${error.kind}, but received '${error.value}'.`,
      field: error.path,
      expectedType: error.kind,
      receivedValue: error.value,
    });
  }

  // MongoDB duplicate key error (code 11000)
  if (error.code === 11000) {
    const fields = Object.keys(error.keyPattern || {}).join(", ");
    return res.status(409).json({
      success: false,
      message: `Duplicate entry error: An order with this '${fields}' already exists.`,
      field: fields,
    });
  }

  // Malformed JSON syntax error
  if (error instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      message: `Malformed request payload: ${error.message}`,
    });
  }

  // Fallback with detailed error message
  return res.status(500).json({
    success: false,
    message: error.message || "An unexpected error occurred while processing the order.",
  });
};

const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const seq  = await Counter.getNextSequence(`ext_order_${year}`);
  return `WS-ORD-${year}-${String(seq).padStart(5, "0")}`;
};


export const getAllActiveWholesalers = async (req, res) => {
  try {
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip   = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    const query = { status: "ACTIVE" };

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { "storeInformation.storeName": regex },
        { "owner.ownerName":            regex },
        { "owner.mobile":               regex },
        { "owner.email":                regex },
        { tenantId:                     regex },
      ];
    }

    const [tenants, total] = await Promise.all([
      Tenant.find(query)
        .select("tenantId status storeInformation owner documents.gstCertificate createdAt updatedAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Tenant.countDocuments(query),
    ]);

    const wholesalers = tenants.map((t) => ({
      tenantId:       t.tenantId,
      storeName:      t.storeInformation?.storeName   || "",
      ownerName:      t.owner?.ownerName              || "",
      mobile:         t.owner?.mobile                 || "",
      email:          t.owner?.email                  || "",
      address:        t.storeInformation?.address     || "",
      storeTiming:    t.storeInformation?.storeTiming || "",
      storeLogo:      t.storeInformation?.storeLogo   || null,
      hasGST:         Boolean(t.storeInformation?.hasGST),
      status:         t.status                        || "ACTIVE",
      storeInformation: {
        storeName:    t.storeInformation?.storeName   || "",
        address:      t.storeInformation?.address     || "",
        hasGST:       Boolean(t.storeInformation?.hasGST),
      },
      owner: {
        ownerName:    t.owner?.ownerName              || "",
        email:        t.owner?.email                  || "",
        mobile:       t.owner?.mobile                 || "",
      },
    }));

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      hasMore: skip + wholesalers.length < total,
      wholesalers,
    });
  } catch (error) {
    return handleExternalError(res, error, "getAllActiveWholesalers");
  }
};

export const receiveExternalOrder = async (req, res) => {
  try {
    let {
      wholesalerTenantId,
      retailerTenantId,
      retailerStoreName,
      retailerMobile,
      retailerEmail,
      shippingCharges,
      otherCharges,
      advanceAmount,
      subtotal,
      grossTotal,
      totalGst,
      netPayableTotal,
      grossTotalWithCharges,
      orderReference,
      remarks,
      shippingAddress,
      orders,
      items,
    } = req.body;

    wholesalerTenantId = (
      wholesalerTenantId ||
      req.query.wholesalerTenantId ||
      req.headers["x-wholesaler-tenant-id"] ||
      ""
    ).trim();

    retailerTenantId = (
      retailerTenantId ||
      req.query.retailerTenantId ||
      req.headers["x-retailer-tenant-id"] ||
      ""
    ).trim();

    if (!wholesalerTenantId) {
      const activeTenant = await Tenant.findOne({ status: "ACTIVE" }).lean();
      if (activeTenant) {
        wholesalerTenantId = activeTenant.tenantId;
      }
    }

    if (!wholesalerTenantId) {
      return res.status(400).json({
        success: false,
        message: "wholesalerTenantId is required.",
      });
    }

    const wholesaler = await Tenant.findOne({
      tenantId: wholesalerTenantId.trim().toUpperCase(),
      status:   "ACTIVE",
    }).lean();

    if (!wholesaler) {
      return res.status(404).json({
        success: false,
        message: "Wholesaler not found or inactive.",
      });
    }

    retailerTenantId  = retailerTenantId?.trim().toUpperCase() || "DIGI-RETAILER";
    retailerStoreName = (retailerStoreName || "Retailer Store").trim();
    retailerMobile    = (retailerMobile || "").trim();
    retailerEmail     = (retailerEmail || "").trim().toLowerCase();

    let processedOrders = [];
    let allItems = [];

    const formatItem = (item, idx = 0) => {
      const prefix = `items[${idx}]`;
      const name = (item.itemName || item.productName || "Product").trim();
      const rawQty = item.qty != null ? item.qty : (item.quantity != null ? item.quantity : 1);
      const qty = Math.max(parseNumber(rawQty, 1, `${prefix}.qty`), 1);
      const rawPrice = item.price != null ? item.price : (item.sellingPrice != null ? item.sellingPrice : 0);
      const price = parseNumber(rawPrice, 0, `${prefix}.price`);
      const subTotal = item.subTotal != null ? parseNumber(item.subTotal, price * qty, `${prefix}.subTotal`) : price * qty;

      return {
        side:            parseSide(item.side || item.rx?.powers?.[0]?.side),
        sph:             parseNullableNumber(item.sph != null ? item.sph : item.rx?.powers?.[0]?.sph, `${prefix}.sph`),
        cyl:             parseNullableNumber(item.cyl != null ? item.cyl : item.rx?.powers?.[0]?.cyl, `${prefix}.cyl`),
        axis:            parseNullableNumber(item.axis != null ? item.axis : item.rx?.powers?.[0]?.axis, `${prefix}.axis`),
        add:             parseNullableNumber(item.add != null ? item.add : item.rx?.powers?.[0]?.add, `${prefix}.add`),
        itemName:        name,
        productName:     name,
        batchNumber:     item.batchNumber ? String(item.batchNumber).trim() : "",
        unit:            item.unit ? String(item.unit).trim() : "",
        category:        item.category ? String(item.category).trim() : "",
        brand:           item.brand ? String(item.brand).trim() : "",
        code:            item.code ? String(item.code).trim() : "",
        color:           item.color ? String(item.color).trim() : "",
        size:            item.size ? String(item.size).trim() : "",
        shape:           item.shape ? String(item.shape).trim() : "",
        material:        item.material ? String(item.material).trim() : "",
        dimensions:      item.dimensions ? String(item.dimensions).trim() : "",
        photos:          Array.isArray(item.photos) ? item.photos : [],
        qty,
        quantity:        qty,
        price,
        sellingPrice:    parseNumber(item.sellingPrice != null ? item.sellingPrice : price, price, `${prefix}.sellingPrice`),
        buyingPrice:     parseNumber(item.buyingPrice, 0, `${prefix}.buyingPrice`),
        gst:             parseNumber(item.gst, 0, `${prefix}.gst`),
        hsnSac:          item.hsnSac ? String(item.hsnSac).trim() : "",
        mrp:             parseNumber(item.mrp, 0, `${prefix}.mrp`),
        discountPercent: parseNumber(item.discountPercent, 0, `${prefix}.discountPercent`),
        discountAmount:  parseNumber(item.discountAmount, 0, `${prefix}.discountAmount`),
        subTotal,
        expectedDate:    parseDate(item.expectedDate, `${prefix}.expectedDate`),
        index:           parseNullableNumber(item.index, `${prefix}.index`),
        tint:            item.tint ? String(item.tint).trim() : (item.rx?.tint ? String(item.rx.tint).trim() : ""),
        coating:         item.coating ? String(item.coating).trim() : (item.rx?.coating ? String(item.rx.coating).trim() : ""),
        expiry:          item.expiry ? String(item.expiry).trim() : "",
        disposability:   item.disposability ? String(item.disposability).trim() : "",
        orderReference:  item.orderReference || req.body.orderReference || "",
        powerType:       item.powerType || item.rx?.powerType || "",
        productMode:     item.productMode || item.rx?.productMode || "",
        hasPrism:        Boolean(item.hasPrism || item.rx?.hasPrism),
        treatment:       item.treatment || item.rx?.treatment || "",
        tintDetails:     item.tintDetails || item.rx?.tintDetails || "",
        remarks:         item.remarks || item.rx?.remarks || "",
      };
    };

    if (Array.isArray(orders) && orders.length > 0) {
      for (let oIdx = 0; oIdx < orders.length; oIdx++) {
        const ord = orders[oIdx];
        if (!ord || !Array.isArray(ord.items) || ord.items.length === 0) {
          continue;
        }
        const ordItems = ord.items.map((it, i) => formatItem(it, `orders[${oIdx}].items[${i}]`));
        allItems.push(...ordItems);

        processedOrders.push({
          orderNumber:           ord.orderNumber || orderReference || "",
          estimatedDeliveryDate: parseDate(ord.estimatedDeliveryDate, `orders[${oIdx}].estimatedDeliveryDate`),
          cgst:                  ord.cgst !== undefined ? String(ord.cgst) : "0",
          sgst:                  ord.sgst !== undefined ? String(ord.sgst) : "0",
          status:                ord.status || "Submitted",
          items:                 ordItems,
        });
      }
    } else if (Array.isArray(items) && items.length > 0) {
      const ordItems = items.map((it, i) => formatItem(it, i));
      allItems.push(...ordItems);

      processedOrders.push({
        orderNumber:           orderReference || "",
        estimatedDeliveryDate: parseDate(req.body.estimatedDeliveryDate, "estimatedDeliveryDate"),
        cgst:                  req.body.cgst !== undefined ? String(req.body.cgst) : "0",
        sgst:                  req.body.sgst !== undefined ? String(req.body.sgst) : "0",
        status:                "Submitted",
        items:                 ordItems,
      });
    }

    if (allItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one order item is required in 'orders' or 'items'.",
      });
    }

    const orderNumber = await generateOrderNumber();
    const firstOrder  = processedOrders[0] || {};

    const order = await ExternalOrder.create({
      orderNumber,
      wholesalerTenantId:    wholesalerTenantId.trim().toUpperCase(),
      retailerTenantId,
      retailerStoreName,
      retailerMobile,
      retailerEmail,

      items:                 allItems,
      estimatedDeliveryDate: firstOrder.estimatedDeliveryDate || (req.body.estimatedDeliveryDate ? parseDate(req.body.estimatedDeliveryDate, "estimatedDeliveryDate") : null),
      cgst:                  firstOrder.cgst  || (req.body.cgst !== undefined ? String(req.body.cgst) : "0"),
      sgst:                  firstOrder.sgst  || (req.body.sgst !== undefined ? String(req.body.sgst) : "0"),

      subtotal:              parseNumber(subtotal, 0, "subtotal"),
      grossTotal:            parseNumber(grossTotal, 0, "grossTotal"),
      totalGst:              parseNumber(totalGst, 0, "totalGst"),
      advanceAmount:         parseNumber(advanceAmount, 0, "advanceAmount"),
      shippingCharges:       parseNumber(shippingCharges, 0, "shippingCharges"),
      otherCharges:          parseNumber(otherCharges, 0, "otherCharges"),
      netPayableTotal:       parseNumber(netPayableTotal, 0, "netPayableTotal"),
      grossTotalWithCharges: parseNumber(grossTotalWithCharges, 0, "grossTotalWithCharges"),

      orderReference:        orderReference?.trim() || firstOrder.orderNumber || "",
      remarks:               remarks?.trim() || "",
      shippingAddress:       shippingAddress?.trim() || "",
      status:                "Submitted",
    });

    return res.status(201).json({
      success:            true,
      message:            "Order placed successfully.",
      orderNumber:        order.orderNumber,
      orderId:            order._id,
      wholesalerTenantId: order.wholesalerTenantId,
      retailerTenantId:   order.retailerTenantId,
      status:             order.status,
      totalItems:         order.items.length,
      grossTotal:         order.grossTotal || order.netPayableTotal,
      order,
    });
  } catch (error) {
    return handleExternalError(res, error, "receiveExternalOrder");
  }
};

export const getExternalOrderStatus = async (req, res) => {
  try {
    const { orderNumber }      = req.params;
    const { retailerTenantId } = req.query;

    const query = {
      $or: [
        { orderNumber: orderNumber },
        { orderReference: orderNumber },
      ],
    };

    if (retailerTenantId) {
      query.retailerTenantId = retailerTenantId.trim().toUpperCase();
    }

    const order = await ExternalOrder.findOne(query).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or access denied.",
      });
    }

    const { __v, _id, ...orderData } = order;

    return res.status(200).json({
      success: true,
      order:   orderData,
    });
  } catch (error) {
    return handleExternalError(res, error, "getExternalOrderStatus");
  }
};

export const getIncomingOrdersForWholesaler = async (req, res) => {
  try {
    const wholesalerTenantId = req.user?.tenantId;
    if (!wholesalerTenantId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip   = (page - 1) * limit;
    const status   = req.query.status;
    const search   = req.query.search?.trim();
    const fromDate = req.query.fromDate;
    const toDate   = req.query.toDate;

    const query = { wholesalerTenantId };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { retailerStoreName: { $regex: search, $options: "i" } },
        { retailerTenantId: { $regex: search, $options: "i" } },
        { orderReference: { $regex: search, $options: "i" } },
        { retailerMobile: { $regex: search, $options: "i" } },
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [orders, total] = await Promise.all([
      ExternalOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExternalOrder.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      hasMore: skip + orders.length < total,
      orders,
    });
  } catch (error) {
    return handleExternalError(res, error, "getIncomingOrdersForWholesaler");
  }
};

export const updateExternalOrderStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status, cancelReason } = req.body;
    const wholesalerTenantId = req.user?.tenantId;

    const validStatuses = [
      "Submitted",
      "Processing",
      "QC",
      "ReadyToDispatch",
      "Dispatched",
      "Delivered",
      "Completed",
      "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await ExternalOrder.findOne({ _id: id, wholesalerTenantId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    order.status = status;
    if (status === "Cancelled" && cancelReason) {
      order.cancelReason = cancelReason;
    }
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`,
      order: {
        orderNumber: order.orderNumber,
        status:      order.status,
        updatedAt:   order.updatedAt,
      },
    });
  } catch (error) {
    return handleExternalError(res, error, "updateExternalOrderStatus");
  }
};
