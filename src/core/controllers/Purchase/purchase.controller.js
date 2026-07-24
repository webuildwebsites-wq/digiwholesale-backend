import mongoose from "mongoose";
import Vendor from "../../../models/Vendor.model.js";
import DigiProduct from "../../../models/Product/Product.model.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { sendEmail } from "../../config/Email/emailService.js";
import VendorPurchaseOrderTemplate from "../../../Utils/Mail/VendorPurchaseOrderTemplate.js";
import VendorOrderUpdatedTemplate from "../../../Utils/Mail/VendorOrderUpdatedTemplate.js";
import { generatePurchaseOrderExcel } from "../../../Utils/excel/generatePurchaseOrderExcel.js";
import PurchaseReturnModel from "../../../models/Purchase/PurchaseReturn.model.js";
import PurchaseInward from "../../../models/Purchase/PurchaseInward.model.js";

const FRAME_SUNGLASS_CATEGORIES = ["FRAME", "SUNGLASS"];
const LENS_CATEGORIES           = ["LENS", "CONTACT_LENS"];

const generatePurchaseOrderNumber = () =>
    `PO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const validatePurchaseItem = (item, product) => {
    const category = (item.category || product.category || "").toUpperCase();

    if (item.orderType && !["STOCK", "RX"].includes(item.orderType)) {
        return "Invalid orderType";
    }

    if (item.orderType === "RX" && !LENS_CATEGORIES.includes(category)) {
        return "RX orderType is only allowed for LENS category";
    }

    if (FRAME_SUNGLASS_CATEGORIES.includes(category)) {
        const requiredFields = ["code", "brand", "color", "size", "shape", "dimensions"];
        for (const field of requiredFields) {
            if (!item[field] && !product[field]) {
                return `${field} is required for ${category}`;
            }
        }
    }

    if (LENS_CATEGORIES.includes(category) && item.orderType !== "RX") {
        if (!item.coating && !product.coating) {
            return `coating is required for ${category}`;
        }
    }

    if (category === "CONTACT_LENS") {
        if (!item.expiry && !product.expiry) return "expiry is required for CONTACT_LENS";
        if (!item.disposability && !product.disposability) return "disposability is required for CONTACT_LENS";
    }

    if (item.orderType === "RX") {
        if (!item.rx || typeof item.rx !== "object") return "rx data is required for RX orderType";
        if (!item.rx.powers || !Array.isArray(item.rx.powers) || item.rx.powers.length === 0) {
            return "rx.powers is required for RX orderType";
        }
        if (!item.rx.vendor?.id || !item.rx.vendor?.name) {
            return "Vendor details are required for RX orders";
        }
    }

    if (item.discountPercent !== undefined && (item.discountPercent < 0 || item.discountPercent > 100)) {
        return "discountPercent must be between 0 and 100";
    }

    if (item.discountAmount !== undefined && item.discountAmount < 0) {
        return "discountAmount cannot be negative";
    }

    if (item.unit !== undefined && !["PIECE", "PAIR", "BOX"].includes(item.unit)) {
        return `Invalid unit "${item.unit}". Must be PIECE, PAIR, or BOX`;
    }

    return null;
};

export const createVendorPurchaseItems = async (req, res) => {
    try {
        const { vendorId, orders } = req.body;

        if (!vendorId) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "vendorId is required");
        }

        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
            return sendErrorResponse(res, 400, "INVALID_VENDOR_ID", "Invalid vendorId");
        }

        if (!Array.isArray(orders) || orders.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "orders array is required and must not be empty");
        }

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Vendor not found");
        }

        const allProductIds = [];
        for (const order of orders) {
            if (!Array.isArray(order.items) || order.items.length === 0) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Each order must have at least one item");
            }
            for (const item of order.items) {
                if (item.productId) {
                    if (!mongoose.Types.ObjectId.isValid(item.productId)) {
                        return sendErrorResponse(res, 400, "INVALID_PRODUCT_ID", `Invalid productId: ${item.productId}`);
                    }
                    allProductIds.push(item.productId.toString());
                } else {
                    if (!item.itemName) {
                        return sendErrorResponse(res, 400, "VALIDATION_ERROR", "itemName is required when productId is not provided");
                    }
                    if (!item.qty || Number(item.qty) <= 0) {
                        return sendErrorResponse(res, 400, "INVALID_QUANTITY", `Quantity must be greater than 0 for item: ${item.itemName}`);
                    }
                }
            }
        }

        const products = await DigiProduct.find({ _id: { $in: allProductIds } }).lean();
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        const uniqueProductIds = [...new Set(allProductIds)];
        const foundIds         = products.map(p => p._id.toString());
        const missingProducts  = uniqueProductIds.filter(id => !foundIds.includes(id));

        if (missingProducts.length > 0) {
            return sendErrorResponse(res, 404, "PRODUCT_NOT_FOUND", `Products not found: ${missingProducts.join(", ")}`);
        }

        for (const order of orders) {
            for (const item of order.items) {
                const qty = Number(item.qty);

                if (item.productId) {
                    const product = productMap.get(item.productId.toString());

                    if (!qty || qty <= 0) {
                        return sendErrorResponse(res, 400, "INVALID_QUANTITY", `Quantity must be greater than 0 for ${product.productName}`);
                    }

                    const rawCategory     = (item.category || product.category || "").toUpperCase();
                    const validationError = validatePurchaseItem(item, product);
                    if (validationError) {
                        return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${validationError}. Product: ${product.productName}`);
                    }

                    if (item.orderType === "STOCK") delete item.rx;

                    item.isNewProduct = false;
                    item.itemName     = item.itemName || product.productName;
                    item.category     = rawCategory;
                    item.price        = item.price    ?? product.price   ?? 0;
                    item.mrp          = item.mrp      ?? product.mrp     ?? 0;
                    item.gst          = item.gst      ?? product.gst     ?? 0;
                    item.hsnSac       = item.hsnSac   || product.hsnSac;
                    item.qty          = qty;

                    if (FRAME_SUNGLASS_CATEGORIES.includes(rawCategory)) {
                        item.code       = item.code       || product.productCode;
                        item.brand      = item.brand      || product.brand;
                        item.color      = item.color      || product.color;
                        item.size       = item.size       || product.size;
                        item.shape      = item.shape      || product.shape;
                        item.material   = item.material   || product.material;
                        item.dimensions = item.dimensions || product.dimensions;
                    }

                    if (LENS_CATEGORIES.includes(rawCategory)) {
                        if (item.orderType === "RX") {
                            item.index   = item.index   ?? product.index;
                            item.coating = item.coating || product.coating;
                        } else {
                            item.sph     = item.sph     ?? product.sph;
                            item.cyl     = item.cyl     ?? product.cyl;
                            item.axis    = item.axis    ?? product.axis;
                            item.add     = item.add     ?? product.add;
                            item.index   = item.index   ?? product.index;
                            item.tint    = item.tint    || product.tint;
                            item.coating = item.coating || product.coating;
                        }
                    }

                    if (rawCategory === "CONTACT_LENS") {
                        item.color         = item.color         || product.color;
                        item.expiry        = item.expiry        || product.expiry;
                        item.disposability = item.disposability || product.disposability;
                    }

                    if (item.orderType === "RX" && item.rx) {
                        const cleanId = (id) => (id && mongoose.Types.ObjectId.isValid(id) ? id : undefined);
                        if (item.rx.vendor)      item.rx.vendor.id      = cleanId(item.rx.vendor.id);
                        if (item.rx.lab)         item.rx.lab.id         = cleanId(item.rx.lab.id);
                        if (item.rx.coating)     item.rx.coating.id     = cleanId(item.rx.coating.id);
                        if (item.rx.treatment)   item.rx.treatment.id   = cleanId(item.rx.treatment.id);
                        if (item.rx.tint)        item.rx.tint.id        = cleanId(item.rx.tint.id);
                        if (item.rx.brand)       item.rx.brand.id       = cleanId(item.rx.brand.id);
                        if (item.rx.category)    item.rx.category.id    = cleanId(item.rx.category.id);
                        if (item.rx.productName) item.rx.productName.id = cleanId(item.rx.productName.id);
                    }
                } else {
                    item.isNewProduct = true;
                    item.productId    = null;
                    item.qty          = qty;
                    item.category     = (item.category || "").toUpperCase();
                    if (item.orderType === "STOCK") delete item.rx;
                }
            }

            if (!order.orderNumber) order.orderNumber = generatePurchaseOrderNumber();
            if (!order.status)      order.status      = "Submitted";
            if (order.cgst !== undefined) order.cgst  = String(order.cgst);
            if (order.sgst !== undefined) order.sgst  = String(order.sgst);
        }

        const vendorDoc = {
            vendorId:   vendor._id,
            vendorName: vendor.name,
            email:      vendor.email    || "",
            mobile:     vendor.mobile   || "",
            address:    vendor.address  || "",
            gstNumber:  vendor.gstNumber || "",
        };

        const vendorPurchase = await VendorPurchase.create({
            vendor:    vendorDoc,
            orders,
            createdBy: req.user._id,
        });

        if (vendor.email) {
            const html = VendorPurchaseOrderTemplate({
                vendorName:      vendor.name,
                purchaseOrderId: vendorPurchase._id.toString(),
                orderDate:       new Date(vendorPurchase.createdAt).toLocaleDateString("en-IN"),
                orders:          vendorPurchase.orders,
            });

            const excelBuffer = generatePurchaseOrderExcel(vendorPurchase.toObject());

            sendEmail({
                to:      vendor.email,
                subject: `New Purchase Order — ${vendorPurchase._id}`,
                html,
                attachments: [
                    {
                        name:    `PurchaseOrder-${vendorPurchase._id}.xlsx`,
                        content: excelBuffer.toString("base64"),
                    },
                ],
            }).catch(err => console.error("Vendor purchase email error:", err.message));
        }

        return sendSuccessResponse(res, 201, { vendorPurchase }, "Vendor purchase order created successfully");

    } catch (error) {
        console.error("Create Vendor Purchase Error:", error);
        return sendErrorResponse(res, 500, "CREATE_VENDOR_PURCHASE_ERROR", error.message || "Something went wrong");
    }
};

export const getAllPurchaseItems = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const { search, vendorId, status, fromDate, toDate } = req.query;

        const filter = {};

        if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
            filter["vendor.vendorId"] = new mongoose.Types.ObjectId(vendorId);
        }

        if (status) filter["orders.status"] = status;

        if (search && search.trim()) {
            const regex = { $regex: search.trim(), $options: "i" };
            filter.$or = [
                { "vendor.vendorName": regex },
                { "orders.orderNumber": regex },
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

        const [purchaseOrders, total] = await Promise.all([
            VendorPurchase.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            VendorPurchase.countDocuments(filter),
        ]);

        const enrichedOrders = purchaseOrders.map(po => {
            const allOrders = po.orders || [];

            const enrichedOrdersList = allOrders.map(order => {
                const items      = order.items || [];
                const totalItems = items.length;

                const inwardDone = items.filter(i => i.inwardStatus !== "PENDING").length;
                const qcDone     = items.filter(i => i.qcStatus     !== "PENDING").length;
                const qcPassed   = items.filter(i => i.qcStatus === "PASSED").length;
                const qcFailed   = items.filter(i => i.qcStatus === "FAILED").length;
                const qcPartial  = items.filter(i => i.qcStatus === "PARTIAL").length;

                return {
                    ...order,
                    orderSummary: {
                        totalItems,
                        inwardDone,
                        inwardPending: totalItems - inwardDone,
                        qcDone,
                        qcPending:     totalItems - qcDone,
                        qcPassed,
                        qcFailed,
                        qcPartial,
                        allReceived:   totalItems > 0 && items.every(i => i.inwardStatus === "RECEIVED"),
                        allQCDone:     totalItems > 0 && items.every(i => i.qcStatus !== "PENDING"),
                    },
                };
            });

            const allItems      = allOrders.flatMap(o => o.items || []);
            const total_items   = allItems.length;
            const inwardDone    = allItems.filter(i => i.inwardStatus !== "PENDING").length;
            const qcDoneCount   = allItems.filter(i => i.qcStatus     !== "PENDING").length;
            const qcPassed      = allItems.filter(i => i.qcStatus === "PASSED").length;
            const qcFailed      = allItems.filter(i => i.qcStatus === "FAILED").length;

            const overallStatus = (() => {
                if (total_items === 0)                                         return "Submitted";
                if (allItems.every(i => i.qcStatus === "PASSED"))             return "QC Passed";
                if (allItems.every(i => i.qcStatus === "FAILED"))             return "QC Failed";
                if (qcDoneCount === total_items)                              return "QC Completed";
                if (qcDoneCount > 0)                                          return "QC In Progress";
                if (allItems.every(i => i.inwardStatus === "RECEIVED"))       return "Fully Received";
                if (inwardDone > 0)                                           return "Partially Received";
                return "Submitted";
            })();

            return {
                ...po,
                overallStatus,
                purchaseOrderSummary: {
                    totalOrders:   allOrders.length,
                    totalItems:    total_items,
                    inwardDone,
                    inwardPending: total_items - inwardDone,
                    qcDone:        qcDoneCount,
                    qcPending:     total_items - qcDoneCount,
                    qcPassed,
                    qcFailed,
                },
                orders: enrichedOrdersList,
            };
        });

        const totalPages = Math.ceil(total / limit);

        return sendSuccessResponse(res, 200, {
            purchaseOrders: enrichedOrders,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        }, "Purchase orders retrieved successfully");

    } catch (error) {
        console.error("Get All Purchase Items Error:", error);
        return sendErrorResponse(res, 500, "GET_PURCHASE_ITEMS_ERROR", error.message || "Something went wrong");
    }
};

export const getVendorPurchaseItemsById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }

        const purchaseOrder = await VendorPurchase.findById(id).lean();
        if (!purchaseOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        }

        return sendSuccessResponse(res, 200, { purchaseOrder }, "Purchase order retrieved successfully");

    } catch (error) {
        console.error("Get Vendor Purchase Items Error:", error);
        return sendErrorResponse(res, 500, "GET_VENDOR_PURCHASE_ERROR", error.message || "Something went wrong");
    }
};

export const deleteVendorPurchaseItems = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }

        const purchaseOrder = await VendorPurchase.findByIdAndDelete(id);
        if (!purchaseOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        }

        return sendSuccessResponse(res, 200, null, "Purchase order deleted successfully");

    } catch (error) {
        console.error("Delete Vendor Purchase Items Error:", error);
        return sendErrorResponse(res, 500, "DELETE_VENDOR_PURCHASE_ERROR", error.message || "Something went wrong");
    }
};

export const updateVendorPurchaseItems = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }

        const purchaseOrder = await VendorPurchase.findById(id);
        if (!purchaseOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        }

        const allowedFields = ["orders"];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) purchaseOrder[field] = req.body[field];
        });

        await purchaseOrder.save();

        const vendor = await Vendor.findById(purchaseOrder.vendor.vendorId).lean();
        if (vendor?.email) {
            const html = VendorOrderUpdatedTemplate({
                vendorName:      purchaseOrder.vendor.vendorName,
                purchaseOrderId: purchaseOrder._id.toString(),
                orderDate:       new Date(purchaseOrder.createdAt).toLocaleDateString("en-IN"),
                updatedAt:       new Date().toLocaleDateString("en-IN"),
                orders:          purchaseOrder.orders,
            });

            const excelBuffer = generatePurchaseOrderExcel(purchaseOrder.toObject());

            sendEmail({
                to:      vendor.email,
                subject: `Purchase Order Updated — ${purchaseOrder._id}`,
                html,
                attachments: [
                    {
                        name:    `PurchaseOrder-Updated-${purchaseOrder._id}.xlsx`,
                        content: excelBuffer.toString("base64"),
                    },
                ],
            }).catch(err => console.error("Vendor update email error:", err.message));
        }

        return sendSuccessResponse(res, 200, { purchaseOrder }, "Purchase order updated successfully");

    } catch (error) {
        console.error("Update Vendor Purchase Items Error:", error);
        return sendErrorResponse(res, 500, "UPDATE_VENDOR_PURCHASE_ERROR", error.message || "Something went wrong");
    }
};

export const getOrdersByVendorId = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;
        const { search, fromDate, toDate } = req.query;

        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
            return sendErrorResponse(res, 400, "INVALID_VENDOR_ID", "Invalid vendorId");
        }

        const vendor = await Vendor.findById(vendorId).lean();
        if (!vendor) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Vendor not found");
        }

        const rxFilter = { "orders.items.rx.vendor.id": vendorId };

        if (search && search.trim()) {
            const regex = { $regex: search.trim(), $options: "i" };
            rxFilter.$or = [
                { "orders.orderNumber": regex },
                { "customer.customerName": regex },
                { "orders.items.itemName": regex },
            ];
        }

        if (fromDate || toDate) {
            rxFilter.createdAt = {};
            if (fromDate) rxFilter.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                rxFilter.createdAt.$lte = end;
            }
        }

        const BulkOrder = (await import("../../../models/order/BulkOrder.js")).default;

        const [bulkOrders, rxTotal] = await Promise.all([
            BulkOrder.find(rxFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            BulkOrder.countDocuments(rxFilter),
        ]);

        const rxOrders = bulkOrders.map((bulkOrder) => ({
            ...bulkOrder,
            orders: bulkOrder.orders.map((order) => ({
                ...order,
                vendorItems: order.items.filter(
                    (item) => item.orderType === "RX" && item.rx?.vendor?.id?.toString() === vendorId
                ),
                totalOrderPrice: Number(
                    order.items
                        .filter((item) => item.orderType === "RX" && item.rx?.vendor?.id?.toString() === vendorId)
                        .reduce((sum, item) => {
                            const price = Number(item.price || 0);
                            const gstPercent = Number(item.gst || 0);
                            return sum + price + (price * gstPercent) / 100;
                        }, 0)
                        .toFixed(2)
                ),
            })).filter((order) => order.vendorItems.length > 0),
        })).filter((bulkOrder) => bulkOrder.orders.length > 0);

        const purchaseFilter = { "vendor.vendorId": new mongoose.Types.ObjectId(vendorId) };
        if (fromDate || toDate) purchaseFilter.createdAt = rxFilter.createdAt;

        const [purchaseOrders, purchaseTotal] = await Promise.all([
            VendorPurchase.find(purchaseFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            VendorPurchase.countDocuments(purchaseFilter),
        ]);

        const totalPages = Math.ceil((rxTotal + purchaseTotal) / limit);

        return sendSuccessResponse(res, 200, {
            vendor: {
                _id:       vendor._id,
                name:      vendor.name,
                email:     vendor.email,
                mobile:    vendor.mobile,
                address:   vendor.address,
                gstNumber: vendor.gstNumber,
            },
            rxOrders,
            purchaseOrders,
            pagination: {
                currentPage:    page,
                totalPages,
                totalRxOrders:       rxTotal,
                totalPurchaseOrders: purchaseTotal,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        }, "Vendor orders retrieved successfully");

    } catch (error) {
        console.error("Get Orders By Vendor Error:", error);
        return sendErrorResponse(res, 500, "GET_VENDOR_ORDERS_ERROR", error.message || "Something went wrong");
    }
};

export const updateVendorRefId = async (req, res) => {
    try {
        const { id } = req.params;
        const { refIds } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid purchase order ID");
        }

        if (!Array.isArray(refIds) || refIds.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "refIds array is required. Each entry: { itemId, vendorRefId }");
        }

        const purchaseOrder = await VendorPurchase.findById(id);
        if (!purchaseOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        }

        const now    = new Date();
        const userId = req.user._id;
        const errors = [];

        const allPurchaseItems = purchaseOrder.orders.flatMap(o => o.items.map(item => ({ order: o, item })));

        for (const entry of refIds) {
            const { itemId, vendorRefId } = entry;

            if (!itemId || vendorRefId === undefined) {
                errors.push(`Invalid entry — itemId and vendorRefId are required: ${JSON.stringify(entry)}`);
                continue;
            }

            if (!mongoose.Types.ObjectId.isValid(itemId)) {
                errors.push(`Invalid itemId: ${itemId}`);
                continue;
            }

            const found = allPurchaseItems.find(({ item }) => item._id.toString() === itemId.toString());
            if (!found) {
                errors.push(`Item not found in this purchase order: ${itemId}`);
                continue;
            }

            const { item } = found;
            item.vendorRefId          = vendorRefId;
            item.vendorRefIdUpdatedAt = now;
            item.vendorRefIdUpdatedBy = userId;
        }

        if (errors.length === refIds.length) {
            return sendErrorResponse(res, 400, "UPDATE_FAILED", `All updates failed: ${errors.join(", ")}`);
        }

        await purchaseOrder.save();

        return sendSuccessResponse(res, 200, { purchaseOrder, errors: errors.length ? errors : undefined }, "Vendor reference IDs updated successfully");

    } catch (error) {
        console.error("Update Vendor RefId Error:", error);
        return sendErrorResponse(res, 500, "UPDATE_VENDOR_REF_ERROR", error.message || "Something went wrong");
    }
};

const buildItemsFilter = (req, extraItemFilter = {}) => {
    const { vendorId, purchaseOrderId, fromDate, toDate, search, isReplacement } = req.query;
    const filter = {};

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
        filter["vendor.vendorId"] = new mongoose.Types.ObjectId(vendorId);
    }
    if (purchaseOrderId && mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
        filter["_id"] = new mongoose.Types.ObjectId(purchaseOrderId);
    }
    if (isReplacement !== undefined) {
        filter.isReplacement = isReplacement === "true";
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
    if (search && search.trim()) {
        filter.$or = [
            { "vendor.vendorName":      { $regex: search.trim(), $options: "i" } },
            { "orders.items.itemName":  { $regex: search.trim(), $options: "i" } },
            { "orders.orderNumber":     { $regex: search.trim(), $options: "i" } },
        ];
    }

    Object.assign(filter, extraItemFilter);
    return filter;
};

const paginateItemsFromPOs = async (req, filter, itemFilter) => {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const purchaseOrders = await VendorPurchase.find(filter).sort({ createdAt: -1 }).lean();

    const allItems = [];
    for (const po of purchaseOrders) {
        for (const order of po.orders) {
            for (const item of order.items) {
                if (itemFilter(item)) {
                    allItems.push({
                        purchaseOrderId: po._id,
                        vendorName:      po.vendor.vendorName,
                        vendorId:        po.vendor.vendorId,
                        orderNumber:     order.orderNumber,
                        cgst:            order.cgst,
                        sgst:            order.sgst,
                        ...item,
                    });
                }
            }
        }
    }

    const total      = allItems.length;
    const paginated  = allItems.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    return {
        items: paginated,
        pagination: {
            currentPage:  page,
            totalPages,
            totalRecords: total,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
};

export const getAllInwardedItems = async (req, res) => {
    try {
        const filter = buildItemsFilter(req, { "orders.items.inwardStatus": { $in: ["RECEIVED", "PARTIAL", "NOT_RECEIVED"] } });
        const result = await paginateItemsFromPOs(req, filter, item => item.inwardStatus !== "PENDING");
        return sendSuccessResponse(res, 200, result, "All inwarded items retrieved successfully");
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_INWARDED_ITEMS_ERROR", error.message);
    }
};

export const getPendingInwardItems = async (req, res) => {
    try {
        const filter = buildItemsFilter(req, { "orders.items.inwardStatus": "PENDING" });
        const result = await paginateItemsFromPOs(req, filter, item => item.inwardStatus === "PENDING");
        return sendSuccessResponse(res, 200, result, "Pending inward items retrieved successfully");
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_PENDING_INWARD_ERROR", error.message);
    }
};

export const getQCPendingItems = async (req, res) => {
    try {
        const filter = buildItemsFilter(req, {
            "orders.items.inwardStatus": { $in: ["RECEIVED", "PARTIAL"] },
            "orders.items.qcStatus":     "PENDING",
        });

        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const purchaseOrders = await VendorPurchase.find(filter).sort({ createdAt: -1 }).lean();

        const allItems = [];
        for (const po of purchaseOrders) {
            const inwardRecord = await PurchaseInward.findOne({ purchaseOrderId: po._id })
                .sort({ createdAt: -1 })
                .lean();

            for (const order of po.orders) {
                for (const item of order.items) {
                    if (item.inwardStatus !== "PENDING" && item.qcStatus === "PENDING") {
                        allItems.push({
                            purchaseOrderId:  po._id,
                            purchaseInwardId: inwardRecord?._id || null,
                            vendorName:       po.vendor.vendorName,
                            vendorId:         po.vendor.vendorId,
                            orderNumber:      order.orderNumber,
                            cgst:             order.cgst,
                            sgst:             order.sgst,
                            ...item,
                        });
                    }
                }
            }
        }

        const total      = allItems.length;
        const paginated  = allItems.slice(skip, skip + limit);
        const totalPages = Math.ceil(total / limit);

        return sendSuccessResponse(res, 200, {
            items: paginated,
            pagination: {
                currentPage:  page,
                totalPages,
                totalRecords: total,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        }, "Items pending QC retrieved successfully");
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_QC_PENDING_ERROR", error.message);
    }
};

export const getQCPassedItems = async (req, res) => {
    try {
        const filter = buildItemsFilter(req, { "orders.items.qcStatus": "PASSED" });

        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const PurchaseQC = (await import("../../../models/Purchase/PurchaseQC.model.js")).default;

        const purchaseOrders = await VendorPurchase.find(filter).sort({ createdAt: -1 }).lean();

        const purchaseOrderIds = purchaseOrders.map(po => po._id);
        const qcRecords = await PurchaseQC.find({ purchaseOrderId: { $in: purchaseOrderIds } })
            .select("purchaseOrderId items createdBy createdByName qcDate")
            .populate("createdBy", "employeeName username")
            .lean();

        const qcMap = new Map();
        for (const qc of qcRecords) {
            const poId = qc.purchaseOrderId.toString();
            if (!qcMap.has(poId)) qcMap.set(poId, []);
            qcMap.get(poId).push(qc);
        }

        const allItems = [];
        for (const po of purchaseOrders) {
            const poQCRecords = qcMap.get(po._id.toString()) || [];

            for (const order of po.orders) {
                for (const item of order.items) {
                    if (item.qcStatus !== "PASSED") continue;

                    let qcDoneBy     = null;
                    let qcDoneByName = null;
                    let qcDate       = null;

                    for (const qc of poQCRecords) {
                        const qcItem = qc.items?.find(qi => qi.itemId?.toString() === item._id?.toString());
                        if (qcItem && qcItem.qcResult === "PASSED") {
                            qcDoneBy     = qc.createdBy;
                            qcDoneByName = qc.createdByName || qc.createdBy?.employeeName || null;
                            qcDate       = qc.qcDate;
                            break;
                        }
                    }

                    allItems.push({
                        purchaseOrderId: po._id,
                        vendorName:      po.vendor.vendorName,
                        vendorId:        po.vendor.vendorId,
                        orderNumber:     order.orderNumber,
                        cgst:            order.cgst,
                        sgst:            order.sgst,
                        qcDoneBy,
                        qcDoneByName,
                        qcDate,
                        ...item,
                    });
                }
            }
        }

        const total      = allItems.length;
        const paginated  = allItems.slice(skip, skip + limit);
        const totalPages = Math.ceil(total / limit);

        return sendSuccessResponse(res, 200, {
            items: paginated,
            pagination: {
                currentPage:  page,
                totalPages,
                totalRecords: total,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        }, "QC passed items retrieved successfully");
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_QC_PASSED_ERROR", error.message);
    }
};

export const createReplacementOrder = async (req, res) => {
    try {
        const { purchaseReturnId, cgst, sgst, remarks, replacementItems } = req.body;

        if (!purchaseReturnId || !mongoose.Types.ObjectId.isValid(purchaseReturnId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid purchaseReturnId is required");
        }
        if (!Array.isArray(replacementItems) || replacementItems.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "replacementItems array is required");
        }

        for (const entry of replacementItems) {
            if (!entry.returnItemId || !mongoose.Types.ObjectId.isValid(entry.returnItemId)) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Valid returnItemId is required for each replacement entry`);
            }
            if (!entry.item || typeof entry.item !== "object") {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `item object is required for returnItemId: ${entry.returnItemId}`);
            }
            if (!entry.item.qty || Number(entry.item.qty) <= 0) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `qty must be greater than 0 for returnItemId: ${entry.returnItemId}`);
            }
            if (!entry.item.itemName && !entry.item.productId) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Either productId or itemName is required for returnItemId: ${entry.returnItemId}`);
            }
        }

        const purchaseReturn = await PurchaseReturnModel.findById(purchaseReturnId);
        if (!purchaseReturn) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase return not found");
        }

        const originalPO = await VendorPurchase.findById(purchaseReturn.purchaseOrderId);
        if (!originalPO) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Original purchase order not found");
        }

        const returnItemsMap = new Map(purchaseReturn.items.map(i => [i.itemId.toString(), i]));

        const invalidIds = replacementItems.filter(e => !returnItemsMap.has(e.returnItemId.toString()));
        if (invalidIds.length > 0) {
            return sendErrorResponse(res, 404, "ITEMS_NOT_FOUND",
                `These returnItemIds are not in this purchase return: ${invalidIds.map(e => e.returnItemId).join(", ")}`
            );
        }

        const alreadyReplaced = replacementItems.filter(e => {
            const ri = returnItemsMap.get(e.returnItemId.toString());
            return ["Replaced", "Closed", "VendorNotified"].includes(ri.itemStatus);
        });
        if (alreadyReplaced.length > 0) {
            return sendErrorResponse(res, 400, "ALREADY_REPLACED",
                `These items already have a replacement in progress or are closed: ${alreadyReplaced.map(e => e.returnItemId).join(", ")}`
            );
        }

        const allProductIds = replacementItems
            .filter(e => e.item.productId)
            .map(e => e.item.productId.toString());

        let productMap = new Map();
        if (allProductIds.length > 0) {
            if (allProductIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
                return sendErrorResponse(res, 400, "INVALID_PRODUCT_ID", "One or more productIds are invalid");
            }
            const products = await DigiProduct.find({ _id: { $in: allProductIds } }).lean();
            const missing  = allProductIds.filter(id => !products.find(p => p._id.toString() === id));
            if (missing.length > 0) {
                return sendErrorResponse(res, 404, "PRODUCT_NOT_FOUND", `Products not found: ${missing.join(", ")}`);
            }
            productMap = new Map(products.map(p => [p._id.toString(), p]));
        }

        const builtItems = [];
        for (const entry of replacementItems) {
            const { returnItemId, item } = entry;
            const returnItem = returnItemsMap.get(returnItemId.toString());
            const qty        = Number(item.qty);

            let builtItem = {
                inwardStatus:     "PENDING",
                qcStatus:         "PENDING",
                receivedQty:      0,
                vendorRefId:      null,
                isPriceConfirmed: false,
            };

            if (item.productId) {
                const product    = productMap.get(item.productId.toString());
                const rawCategory = (item.category || product.category || "").toUpperCase();

                const validationError = validatePurchaseItem(item, product);
                if (validationError) {
                    return sendErrorResponse(res, 400, "VALIDATION_ERROR",
                        `${validationError}. Product: ${product.productName} (returnItemId: ${returnItemId})`
                    );
                }

                if (item.orderType === "STOCK") delete item.rx;

                builtItem = {
                    ...builtItem,
                    productId:      product._id,
                    isNewProduct:   false,
                    orderType:      item.orderType || "STOCK",
                    itemName:       item.itemName  || product.productName,
                    category:       rawCategory,
                    code:           item.code      || product.productCode,
                    brand:          item.brand     || product.brand,
                    color:          item.color     || product.color,
                    size:           item.size      || product.size,
                    shape:          item.shape     || product.shape,
                    material:       item.material  || product.material,
                    dimensions:     item.dimensions|| product.dimensions,
                    unit:           item.unit      || "PIECE",
                    qty,
                    price:          item.price     ?? product.price   ?? 0,
                    mrp:            item.mrp       ?? product.mrp     ?? 0,
                    gst:            item.gst       ?? product.gst     ?? 0,
                    hsnSac:         item.hsnSac    || product.hsnSac,
                    discountPercent:item.discountPercent || 0,
                    discountAmount: item.discountAmount  || 0,
                    sph:            item.sph       ?? product.sph,
                    cyl:            item.cyl       ?? product.cyl,
                    axis:           item.axis      ?? product.axis,
                    add:            item.add       ?? product.add,
                    index:          item.index     ?? product.index,
                    coating:        item.coating   || product.coating,
                    tint:           item.tint      || product.tint,
                    expiry:         item.expiry    || product.expiry,
                    disposability:  item.disposability || product.disposability,
                    rx:             item.rx,
                    _returnItemId:  returnItemId,
                };
            } else {
                builtItem = {
                    ...builtItem,
                    productId:      null,
                    isNewProduct:   true,
                    orderType:      item.orderType || "STOCK",
                    itemName:       item.itemName,
                    category:       (item.category || returnItem.category || "").toUpperCase(),
                    code:           item.code       || "",
                    brand:          item.brand      || "",
                    color:          item.color      || "",
                    size:           item.size       || "",
                    shape:          item.shape      || "",
                    material:       item.material   || "",
                    dimensions:     item.dimensions || "",
                    unit:           item.unit       || "PIECE",
                    qty,
                    price:          item.price      ?? 0,
                    mrp:            item.mrp        ?? 0,
                    gst:            item.gst        ?? 0,
                    hsnSac:         item.hsnSac     || "",
                    discountPercent:item.discountPercent || 0,
                    discountAmount: item.discountAmount  || 0,
                    sph:            item.sph,
                    cyl:            item.cyl,
                    axis:           item.axis,
                    add:            item.add,
                    index:          item.index,
                    coating:        item.coating    || "",
                    tint:           item.tint       || "",
                    expiry:         item.expiry     || "",
                    disposability:  item.disposability || "",
                    _returnItemId:  returnItemId,
                };
            }

            builtItems.push(builtItem);
        }

        const allOriginalItems = originalPO.orders.flatMap(o => o.items);

        const priceDifferences = [];
        let   totalPriceDiff   = 0;

        for (const entry of replacementItems) {
            const returnItem   = returnItemsMap.get(entry.returnItemId.toString());
            const originalItem = allOriginalItems.find(i => i._id.toString() === entry.returnItemId.toString());

            const originalPrice    = Number(originalItem?.price ?? returnItem?.amount ?? 0);
            const replacementPrice = Number(entry.item?.price ?? 0);
            const qty              = Number(entry.item?.qty ?? returnItem?.qty ?? 1);
            const itemDiff         = (replacementPrice - originalPrice) * qty;

            totalPriceDiff += itemDiff;

            priceDifferences.push({
                returnItemId:     entry.returnItemId,
                itemName:         returnItem?.itemName || "",
                qty,
                originalPrice,
                replacementPrice,
                priceDiffPerUnit: Number((replacementPrice - originalPrice).toFixed(2)),
                totalItemDiff:    Number(itemDiff.toFixed(2)),
                direction:        itemDiff > 0 ? "HIGHER" : itemDiff < 0 ? "LOWER" : "SAME",
            });
        }

        const vendor    = await Vendor.findById(originalPO.vendor.vendorId).lean();
        const vendorDoc = {
            vendorId:   originalPO.vendor.vendorId,
            vendorName: originalPO.vendor.vendorName,
            email:      originalPO.vendor.email,
            mobile:     originalPO.vendor.mobile,
            address:    originalPO.vendor.address,
            gstNumber:  originalPO.vendor.gstNumber,
        };

        const replacementPO = await VendorPurchase.create({
            vendor:                  vendorDoc,
            isReplacement:           true,
            replacementFor:          purchaseReturnId,
            originalPurchaseOrderId: originalPO._id,
            orders: [{
                orderNumber: generatePurchaseOrderNumber(),
                items:       builtItems,
                cgst:        cgst ? String(cgst) : (originalPO.orders[0]?.cgst || "0"),
                sgst:        sgst ? String(sgst) : (originalPO.orders[0]?.sgst || "0"),
                status:      "Submitted",
                remarks:     remarks || `Replacement for Purchase Return ${purchaseReturnId}`,
            }],
            createdBy: req.user._id,
        });

        for (const entry of replacementItems) {
            const returnItem = purchaseReturn.items.find(i => i.itemId.toString() === entry.returnItemId.toString());
            if (returnItem) {
                returnItem.itemStatus    = "VendorNotified";
                returnItem.itemUpdatedAt = new Date();
                returnItem.itemUpdatedBy = req.user._id;
                returnItem.itemRemarks   = `Replacement PO created: ${replacementPO._id}`;
            }
        }

        const allNotified = purchaseReturn.items.every(i =>
            ["Replaced", "Closed", "VendorNotified"].includes(i.itemStatus)
        );
        if (allNotified) purchaseReturn.status = "VendorNotified";
        await purchaseReturn.save();

        if (vendor?.email) {
            const html = VendorPurchaseOrderTemplate({
                vendorName:      vendorDoc.vendorName,
                purchaseOrderId: replacementPO._id.toString(),
                orderDate:       new Date(replacementPO.createdAt).toLocaleDateString("en-IN"),
                orders:          replacementPO.orders,
            });

            const excelBuffer = generatePurchaseOrderExcel(replacementPO.toObject());

            sendEmail({
                to:      vendor.email,
                subject: `Replacement Purchase Order — ${replacementPO._id}`,
                html,
                attachments: [{
                    name:    `ReplacementOrder-${replacementPO._id}.xlsx`,
                    content: excelBuffer.toString("base64"),
                }],
            }).catch(err => console.error("Replacement order email error:", err.message));
        }

        return sendSuccessResponse(res, 201, {
            replacementOrder:        replacementPO,
            itemsReplacing:          replacementItems.length,
            purchaseReturnId,
            originalPurchaseOrderId: originalPO._id,
            priceDifferences,
            totalPriceDifference: {
                amount:    Number(totalPriceDiff.toFixed(2)),
                direction: totalPriceDiff > 0 ? "HIGHER" : totalPriceDiff < 0 ? "LOWER" : "SAME",
                label:     totalPriceDiff > 0
                    ? `Replacement is ₹${Math.abs(totalPriceDiff).toFixed(2)} more expensive`
                    : totalPriceDiff < 0
                        ? `Replacement is ₹${Math.abs(totalPriceDiff).toFixed(2)} cheaper`
                        : "Same price as original",
            },
        }, `Replacement order created for ${replacementItems.length} item(s). Vendor notified.`);

    } catch (error) {
        console.error("Create Replacement Order Error:", error);
        return sendErrorResponse(res, 500, "CREATE_REPLACEMENT_ERROR", error.message);
    }
};

export const getAllReplacementOrders = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const filter = { isReplacement: true };

        if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
            filter["vendor.vendorId"] = new mongoose.Types.ObjectId(req.query.vendorId);
        }
        if (req.query.purchaseReturnId && mongoose.Types.ObjectId.isValid(req.query.purchaseReturnId)) {
            filter.replacementFor = new mongoose.Types.ObjectId(req.query.purchaseReturnId);
        }
        if (req.query.originalPurchaseOrderId && mongoose.Types.ObjectId.isValid(req.query.originalPurchaseOrderId)) {
            filter.originalPurchaseOrderId = new mongoose.Types.ObjectId(req.query.originalPurchaseOrderId);
        }
        if (req.query.search?.trim()) {
            const regex = { $regex: req.query.search.trim(), $options: "i" };
            filter.$or = [
                { "vendor.vendorName":       regex },
                { "orders.orderNumber":      regex },
                { "orders.items.itemName":   regex },
            ];
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

        const [replacementOrders, total] = await Promise.all([
            VendorPurchase.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            VendorPurchase.countDocuments(filter),
        ]);

        const enriched = await Promise.all(
            replacementOrders.map(async po => {
                const purchaseReturn = po.replacementFor
                    ? await PurchaseReturnModel.findById(po.replacementFor).lean()
                    : null;

                const allItems   = po.orders.flatMap(o => o.items || []);
                const qcPassed   = allItems.filter(i => i.qcStatus === "PASSED").length;
                const qcFailed   = allItems.filter(i => i.qcStatus === "FAILED").length;
                const qcPending  = allItems.filter(i => i.qcStatus === "PENDING").length;
                const inwardDone = allItems.filter(i => i.inwardStatus !== "PENDING").length;

                const overallStatus = (() => {
                    if (allItems.length === 0)                                  return "Submitted";
                    if (allItems.every(i => i.qcStatus === "PASSED"))          return "QC Passed";
                    if (allItems.every(i => i.qcStatus === "FAILED"))          return "QC Failed";
                    if (allItems.every(i => i.qcStatus !== "PENDING"))         return "QC Completed";
                    if (allItems.some(i => i.qcStatus !== "PENDING"))          return "QC In Progress";
                    if (allItems.every(i => i.inwardStatus === "RECEIVED"))    return "Fully Received";
                    if (inwardDone > 0)                                        return "Partially Received";
                    return "Submitted";
                })();

                return {
                    ...po,
                    overallStatus,
                    replacementSummary: {
                        totalItems:  allItems.length,
                        inwardDone,
                        inwardPending: allItems.length - inwardDone,
                        qcPassed,
                        qcFailed,
                        qcPending,
                    },
                    purchaseReturnDetails: purchaseReturn ? {
                        _id:        purchaseReturn._id,
                        status:     purchaseReturn.status,
                        vendorName: purchaseReturn.vendorName,
                        items:      purchaseReturn.items,
                    } : null,
                };
            })
        );

        return sendSuccessResponse(res, 200, {
            replacementOrders: enriched,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Replacement orders retrieved successfully");

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_REPLACEMENT_ORDERS_ERROR", error.message);
    }
};

export const getReplacementOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }

        const po = await VendorPurchase.findOne({ _id: id, isReplacement: true }).lean();
        if (!po) return sendErrorResponse(res, 404, "NOT_FOUND", "Replacement order not found");

        const [purchaseReturn, originalPO] = await Promise.all([
            po.replacementFor
                ? PurchaseReturnModel.findById(po.replacementFor).lean()
                : null,
            po.originalPurchaseOrderId
                ? VendorPurchase.findById(po.originalPurchaseOrderId).lean()
                : null,
        ]);

        return sendSuccessResponse(res, 200, {
            replacementOrder: po,
            purchaseReturn:   purchaseReturn || null,
            originalPurchaseOrder: originalPO ? {
                _id:         originalPO._id,
                vendor:      originalPO.vendor,
                orderNumber: originalPO.orders[0]?.orderNumber,
                createdAt:   originalPO.createdAt,
            } : null,
        }, "Replacement order retrieved successfully");

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_REPLACEMENT_ORDER_ERROR", error.message);
    }
};
