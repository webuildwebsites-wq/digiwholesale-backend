import Tenant        from "../../models/Tenant/Tenant.model.js";
import ExternalOrder from "../../models/ExternalOrder.model.js";
import Counter       from "../../models/Auth/Counter.js";

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
    console.error("getAllActiveWholesalers error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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

    const formatItem = (item) => {
      const name = (item.itemName || item.productName || "Product").trim();
      const qty = Math.max(Number(item.qty != null ? item.qty : (item.quantity != null ? item.quantity : 1)), 1);
      const price = Number(item.price != null ? item.price : (item.sellingPrice != null ? item.sellingPrice : 0));
      const subTotal = Number(item.subTotal != null ? item.subTotal : price * qty);

      return {
        side:            item.side || item.rx?.powers?.[0]?.side || undefined,
        sph:             item.sph != null ? Number(item.sph) : (item.rx?.powers?.[0]?.sph != null ? Number(item.rx.powers[0].sph) : null),
        cyl:             item.cyl != null ? Number(item.cyl) : (item.rx?.powers?.[0]?.cyl != null ? Number(item.rx.powers[0].cyl) : null),
        axis:            item.axis != null ? Number(item.axis) : (item.rx?.powers?.[0]?.axis != null ? Number(item.rx.powers[0].axis) : null),
        add:             item.add != null ? Number(item.add) : (item.rx?.powers?.[0]?.add != null ? Number(item.rx.powers[0].add) : null),
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
        sellingPrice:    Number(item.sellingPrice != null ? item.sellingPrice : price),
        buyingPrice:     Number(item.buyingPrice || 0),
        gst:             Number(item.gst || 0),
        hsnSac:          item.hsnSac ? String(item.hsnSac).trim() : "",
        mrp:             Number(item.mrp || 0),
        discountPercent: Number(item.discountPercent || 0),
        discountAmount:  Number(item.discountAmount || 0),
        subTotal,
        expectedDate:    item.expectedDate ? new Date(item.expectedDate) : null,
        index:           item.index != null ? Number(item.index) : null,
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
      for (const ord of orders) {
        if (!Array.isArray(ord.items) || ord.items.length === 0) {
          continue;
        }
        const ordItems = ord.items.map(formatItem);
        allItems.push(...ordItems);

        processedOrders.push({
          orderNumber:           ord.orderNumber || orderReference || "",
          estimatedDeliveryDate: ord.estimatedDeliveryDate ? new Date(ord.estimatedDeliveryDate) : null,
          cgst:                  ord.cgst !== undefined ? String(ord.cgst) : "0",
          sgst:                  ord.sgst !== undefined ? String(ord.sgst) : "0",
          status:                ord.status || "Submitted",
          items:                 ordItems,
        });
      }
    } else if (Array.isArray(items) && items.length > 0) {
      const ordItems = items.map(formatItem);
      allItems.push(...ordItems);

      processedOrders.push({
        orderNumber:           orderReference || "",
        estimatedDeliveryDate: null,
        cgst:                  "0",
        sgst:                  "0",
        status:                "Submitted",
        items:                 ordItems,
      });
    }

    if (allItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one order item is required.",
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
      estimatedDeliveryDate: firstOrder.estimatedDeliveryDate || (req.body.estimatedDeliveryDate ? new Date(req.body.estimatedDeliveryDate) : null),
      cgst:                  firstOrder.cgst  || (req.body.cgst !== undefined ? String(req.body.cgst) : "0"),
      sgst:                  firstOrder.sgst  || (req.body.sgst !== undefined ? String(req.body.sgst) : "0"),

      subtotal:              Number(subtotal              || 0),
      grossTotal:            Number(grossTotal            || 0),
      totalGst:              Number(totalGst              || 0),
      advanceAmount:         Number(advanceAmount         || 0),
      shippingCharges:       Number(shippingCharges       || 0),
      otherCharges:          Number(otherCharges          || 0),
      netPayableTotal:       Number(netPayableTotal       || 0),
      grossTotalWithCharges: Number(grossTotalWithCharges || 0),

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
    console.error("receiveExternalOrder error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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
    console.error("getExternalOrderStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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
    console.error("getIncomingOrdersForWholesaler error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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
    console.error("updateExternalOrderStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
