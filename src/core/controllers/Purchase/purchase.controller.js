import mongoose from "mongoose";
import Vendor from "../../../models/Vendor.model.js";
import DigiProduct from "../../../models/Product/Product.model.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { sendEmail } from "../../config/Email/emailService.js";
import VendorPurchaseOrderTemplate from "../../../Utils/Mail/VendorPurchaseOrderTemplate.js";
import VendorOrderUpdatedTemplate from "../../../Utils/Mail/VendorOrderUpdatedTemplate.js";
import { generatePurchaseOrderExcel } from "../../../Utils/excel/generatePurchaseOrderExcel.js";

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
