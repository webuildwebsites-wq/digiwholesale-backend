import mongoose from "mongoose";
import Customer from "../../../../models/Auth/Customer.js";
import BulkOrder from "../../../../models/order/BulkOrder.js";
import DigiProduct from "../../../../models/Product/Product.model.js";
import Vendor from "../../../../models/Vendor.model.js";
import Employee from "../../../../models/Auth/Employee.js";
import generatePDF from "../../../services/pdfService.js";
import { generateDeliveryChallanHTML, generatedorderInvoice } from "../../../../Utils/templates/deliveryChallanTemplate.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../../Utils/response/responseHandler.js";
import { sendEmail } from "../../../config/Email/emailService.js";
import VendorRxOrderTemplate from "../../../../Utils/Mail/VendorRxOrderTemplate.js";
import { handleOrderBillingNotification } from "../../../services/billing/billingNotification.service.js";
import { generateLowStockExcel } from "../../../../Utils/excel/generateLowStockExcel.js";

const sendLowStockAlerts = async ({ orders, productMap, customerName, orderNumber }) => {
    try {
        const lowStockItems = [];

        for (const order of orders) {
            for (const item of order.items) {
                const product = productMap[item.productId?.toString()];
                if (!product) continue;

                const orderedQty = Number(item.qty || 0);
                const availableQty = Number(product.qty ?? 0);

                if (availableQty < orderedQty) {
                    lowStockItems.push({
                        productName: product.productName || product.productCode || "",
                        productCode: product.productCode || "",
                        category: product.category || "",
                        brand: product.brand || "",
                        unit: product.unit || item.unit || "",
                        orderedQty,
                        availableQty,
                        shortfall: orderedQty - availableQty,
                        price: product.price ?? 0,
                        mrp: product.mrp ?? 0,
                        gst: product.gst ?? 0,
                        hsnSac: product.hsnSac || "",
                        index: product.index ?? "",
                        coating: product.coating || "",
                        tint: product.tint || "",
                        sph: product.sph ?? "",
                        cyl: product.cyl ?? "",
                        axis: product.axis ?? "",
                        add: product.add ?? "",
                        color: product.color || "",
                        size: product.size || "",
                        shape: product.shape || "",
                        material: product.material || "",
                        dimensions: product.dimensions || "",
                        expiry: product.expiry || "",
                        disposability: product.disposability || "",
                    });
                }
            }
        }

        if (lowStockItems.length === 0) return;

        const staff = await Employee.find({
            EmployeeType: { $in: ["SUPERADMIN", "ADMIN"] },
            isActive: true,
            isDeleted: false,
            email: { $exists: true, $ne: "" },
        }).select("email employeeName").lean();

        if (!staff.length) return;

        const itemRows = lowStockItems.map((item, idx) => `
            <tr style="background:${idx % 2 === 0 ? "#fff" : "#fef2f2"};">
                <td style="padding:9px 12px;border:1px solid #fecaca;">${item.productName}</td>
                <td style="padding:9px 12px;border:1px solid #fecaca;">${item.productCode}</td>
                <td style="padding:9px 12px;border:1px solid #fecaca;">${item.category}</td>
                <td style="padding:9px 12px;border:1px solid #fecaca;text-align:center;">${item.orderedQty}</td>
                <td style="padding:9px 12px;border:1px solid #fecaca;text-align:center;color:#16a34a;font-weight:bold;">${item.availableQty}</td>
                <td style="padding:9px 12px;border:1px solid #fecaca;text-align:center;color:#dc2626;font-weight:bold;">${item.shortfall}</td>
            </tr>`).join("");

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:700px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:20px 28px;color:#fff;">
      <div style="font-size:20px;font-weight:700;">DigiOptics — Low Stock Alert</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">Inventory Update Required</div>
    </div>
    <div style="padding:18px 28px;background:#fef2f2;border-bottom:2px solid #dc2626;">
      <p style="margin:0;font-size:14px;color:#555;">
        A new order from <b>${customerName}</b> (Order: <b>${orderNumber}</b>) has been placed, but the following items have
        <b style="color:#dc2626;">insufficient stock</b>. Please update the inventory immediately.
        Full details are attached in the Excel file.
      </p>
    </div>
    <div style="padding:20px 28px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#fee2e2;">
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Product</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Code</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Category</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:center;">Ordered</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:center;">Available</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:center;">Shortfall</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:13px;color:#7f1d1d;">
        <b>Action required:</b> Please update inventory to ensure order fulfilment. Full product details are in the attached Excel file.
      </div>
    </div>
    <div style="background:#f5f5f5;text-align:center;padding:14px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics. System generated alert.
    </div>
  </div>
</body>
</html>`;

        const excelBuffer = generateLowStockExcel({
            orderNumber,
            customerName,
            orderDate: new Date().toLocaleDateString("en-IN"),
            lowStockItems,
        });

        const emailPromises = staff.map(s =>
            sendEmail({
                to: s.email,
                subject: `⚠️ Low Stock Alert — Order ${orderNumber} from ${customerName}`,
                html,
                attachments: [{
                    name: `LowStock-${orderNumber}.xlsx`,
                    content: excelBuffer.toString("base64"),
                }],
            }).catch(err => console.error(`Low stock alert email error for ${s.email}:`, err.message))
        );

        await Promise.all(emailPromises);
        console.log(`Low stock alert sent to ${staff.length} staff for order ${orderNumber}`);

    } catch (err) {
        console.error("sendLowStockAlerts error:", err.message);
    }
};

// const VALID_CATEGORIES        = ["FRAME", "SUNGLASS", "LENS", "CONTACT_LENS"];
const FRAME_SUNGLASS_CATEGORIES = ["FRAME", "SUNGLASS"];
const LENS_CATEGORIES = ["LENS", "CONTACT_LENS"];

const generateOrderNumber = () => `BO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const sendVendorRxOrderEmails = async ({ bulkOrder, customer }) => {
    try {
        const vendorItemsMap = new Map();

        for (const order of bulkOrder.orders) {
            for (const item of order.items) {
                if (item.orderType !== "RX") continue;

                const vendorId = item.rx?.vendor?.id?.toString();
                const vendorName = item.rx?.vendor?.name;
                if (!vendorId) continue;

                if (!vendorItemsMap.has(vendorId)) {
                    vendorItemsMap.set(vendorId, { vendorName, items: [] });
                }
                vendorItemsMap.get(vendorId).items.push(item);
            }
        }

        if (vendorItemsMap.size === 0) return;

        const vendorIds = [...vendorItemsMap.keys()].filter(id => mongoose.Types.ObjectId.isValid(id));
        const vendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
        const vendorEmailMap = new Map(vendors.map(v => [v._id.toString(), v.email]));

        const orderDate = new Date(bulkOrder.createdAt).toLocaleDateString("en-IN");
        const orderNumber = bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString();

        const shipTo = bulkOrder.customer.customerShipToBranchName || bulkOrder.customer.customerName;

        const emailPromises = [];

        for (const [vendorId, { vendorName, items }] of vendorItemsMap) {
            const vendorEmail = vendorEmailMap.get(vendorId);
            if (!vendorEmail) {
                console.warn(`No email found for vendor ${vendorId} (${vendorName}), skipping.`);
                continue;
            }

            const html = VendorRxOrderTemplate({
                vendorName,
                orderNumber,
                orderDate,
                customer: {
                    name: customer.ownerName || customer.shopName,
                    phone: customer.mobileNo1 || "",
                },
                shipTo,
                items,
            });

            emailPromises.push(
                sendEmail({
                    to: vendorEmail,
                    subject: `RX Order ${orderNumber} — DigiOptics`,
                    html,
                }).catch(err => console.error(`Failed to send email to vendor ${vendorId}:`, err.message))
            );
        }

        await Promise.all(emailPromises);
    } catch (err) {
        console.error("sendVendorRxOrderEmails error:", err.message);
    }
};

const validateItemByCategory = (item, product) => {
    const category = (item.category || product.category || "").toUpperCase();

    // if (!VALID_CATEGORIES.includes(category)) {
    //     return `Invalid category "${category}"`;
    // }

    if (item.orderType && !["STOCK", "RX"].includes(item.orderType)) {
        return "Invalid orderType";
    }

    if (item.orderType === "RX" && category !== "LENS") {
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
        if (item.sph === undefined && item.sph === null && product.sph === undefined) {
            return `sph is required for ${category}`;
        }
        // if (!item.tint && !product.tint) {
        //     return `tint is required for ${category}`;
        // }
        if (!item.coating && !product.coating) {
            return `coating is required for ${category}`;
        }
    }

    if (category === "CONTACT_LENS") {
        if (!item.expiry && !product.expiry) {
            return "expiry is required for CONTACT_LENS";
        }
        if (!item.disposability && !product.disposability) {
            return "disposability is required for CONTACT_LENS";
        }
    }

    if (item.orderType === "RX") {
        if (!item.rx || typeof item.rx !== "object") {
            return "rx data is required for RX orderType";
        }
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

export const createBulkOrder = async (req, res) => {
    try {
        const { customerId, customerShipToId, orders, isDraft } = req.body;

        if (!customerId) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "customerId is required");
        }

        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            return sendErrorResponse(res, 400, "INVALID_CUSTOMER_ID", "Invalid customerId");
        }

        if (customerShipToId && !mongoose.Types.ObjectId.isValid(customerShipToId)) {
            return sendErrorResponse(res, 400, "INVALID_SHIP_TO_ID", "Invalid customerShipToId");
        }

        if (!Array.isArray(orders) || orders.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "orders array is required and must not be empty");
        }

        const customer = await Customer.findById(customerId);

        if (!customer) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
        }

        if (customer.status?.isSuspended) {
            return sendErrorResponse(res, 403, "CUSTOMER_SUSPENDED", "Customer account is suspended");
        }

        if (customer.isBlacklisted) {
            return sendErrorResponse(res, 403, "CUSTOMER_BLACKLISTED", "Customer is blacklisted");
        }

        let shipToBranchName = null;
        let resolvedShipToId = null;

        if (customerShipToId) {
            const shipTo = customer.customerShipToDetails?.find(
                (s) => s._id.toString() === customerShipToId.toString()
            );

            if (!shipTo) {
                return sendErrorResponse(res, 404, "NOT_FOUND", "Ship-to address not found for this customer");
            }

            resolvedShipToId = shipTo._id;
            shipToBranchName = shipTo.branchName;
        }

        const allProductIds = [];

        for (const order of orders) {
            if (!Array.isArray(order.items) || order.items.length === 0) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", "Each order must have at least one item");
            }

            for (const item of order.items) {
                if (!item.productId) {
                    return sendErrorResponse(res, 400, "VALIDATION_ERROR", "productId is required for every item");
                }
                if (!mongoose.Types.ObjectId.isValid(item.productId)) {
                    return sendErrorResponse(res, 400, "INVALID_PRODUCT_ID", `Invalid productId: ${item.productId}`);
                }
                allProductIds.push(item.productId.toString());
            }
        }

        const products = await DigiProduct.find({ _id: { $in: allProductIds } }).lean();
        const productMap = {};
        products.forEach((p) => { productMap[p._id.toString()] = p; });

        const uniqueProductIds = [...new Set(allProductIds)];
        const foundIds = products.map((p) => p._id.toString());
        const missingProducts = uniqueProductIds.filter((id) => !foundIds.includes(id));

        if (missingProducts.length > 0) {
            return sendErrorResponse(res, 404, "PRODUCT_NOT_FOUND", `Products not found: ${missingProducts.join(", ")}`);
        }

        for (const order of orders) {
            for (const item of order.items) {
                const product = productMap[item.productId.toString()];

                if (!product) {
                    return sendErrorResponse(res, 404, "PRODUCT_NOT_FOUND", `Product not found: ${item.productId}`);
                }

                const qty = Number(item.qty);

                if (!qty || qty <= 0) {
                    return sendErrorResponse(res, 400, "INVALID_QUANTITY", `Quantity must be greater than 0 for ${product.productName}`);
                }

                const rawCategory = (item.category || product.category || "").toUpperCase();
                const validationError = validateItemByCategory(item, product);

                if (validationError) {
                    return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${validationError}. Product: ${product.productName}`);
                }

                if (item.orderType === "STOCK") {
                    delete item.rx;
                }

                item.itemName = item.itemName || product.productName;
                item.category = rawCategory;
                item.price = item.price ?? product.price ?? 0;
                item.mrp = item.mrp ?? product.mrp ?? 0;
                item.gst = item.gst ?? product.gst ?? 0;
                item.hsnSac = item.hsnSac || product.hsnSac;
                item.qty = qty;

                if (FRAME_SUNGLASS_CATEGORIES.includes(rawCategory)) {
                    item.code = item.code || product.productCode;
                    item.brand = item.brand || product.brand;
                    item.color = item.color || product.color;
                    item.size = item.size || product.size;
                    item.type = item.type || product.type;
                    item.shape = item.shape || product.shape;
                    item.material = item.material || product.material;
                    item.dimensions = item.dimensions || product.dimensions;
                }

                if (LENS_CATEGORIES.includes(rawCategory)) {
                    if (item.orderType === "RX") {
                        item.index = item.index ?? product.index;
                        item.coating = item.coating || product.coating;
                    } else {
                        item.sph = item.sph ?? product.sph;
                        item.cyl = item.cyl ?? product.cyl;
                        item.axis = item.axis ?? product.axis;
                        item.add = item.add ?? product.add;
                        item.index = item.index ?? product.index;
                        item.tint = item.tint || product.tint;
                        item.coating = item.coating || product.coating;
                    }
                }

                if (rawCategory === "CONTACT_LENS") {
                    item.color = item.color || product.color;
                    item.expiry = item.expiry || product.expiry;
                    item.disposability = item.disposability || product.disposability;
                }

                if (item.orderType === "RX" && item.rx) {
                    const cleanId = (id) => (id && mongoose.Types.ObjectId.isValid(id) ? id : undefined);
                    if (item.rx.vendor) item.rx.vendor.id = cleanId(item.rx.vendor.id);
                    if (item.rx.lab) item.rx.lab.id = cleanId(item.rx.lab.id);
                    if (item.rx.coating) item.rx.coating.id = cleanId(item.rx.coating.id);
                    if (item.rx.treatment) item.rx.treatment.id = cleanId(item.rx.treatment.id);
                    if (item.rx.tint) item.rx.tint.id = cleanId(item.rx.tint.id);
                    if (item.rx.brand) item.rx.brand.id = cleanId(item.rx.brand.id);
                    if (item.rx.category) item.rx.category.id = cleanId(item.rx.category.id);
                    if (item.rx.productName) item.rx.productName.id = cleanId(item.rx.productName.id);
                }
            }

            if (!order.orderNumber) {
                order.orderNumber = generateOrderNumber();
            }

            if (!order.status) {
                order.status = isDraft === true ? "Draft" : "Submitted";
            }

            if (order.cgst !== undefined) order.cgst = String(order.cgst);
            if (order.sgst !== undefined) order.sgst = String(order.sgst);
        }

        const customerDoc = {
            customerId: customer._id,
            customerName: customer.ownerName || customer.shopName,
            customerShipToId: resolvedShipToId,
            customerShipToBranchName: shipToBranchName,
        };

        const bulkOrder = await BulkOrder.create({ customer: customerDoc, orders });

        sendVendorRxOrderEmails({ bulkOrder, customer }).catch(err =>
            console.error("Vendor email notification error:", err.message)
        );

        if (!isDraft) {
            handleOrderBillingNotification({ bulkOrder, customer }).catch(err =>
                console.error("Billing notification error:", err.message)
            );

            sendLowStockAlerts({
                orders: bulkOrder.orders,
                productMap,
                customerName: customer.ownerName || customer.shopName,
                orderNumber: bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString(),
            }).catch(err => console.error("Low stock alert error:", err.message));
        }

        return sendSuccessResponse(res, 201, {
            bulkOrder,
        }, "Bulk order created successfully");
    } catch (error) {
        console.error("Create Bulk Order Error:", error);
        return sendErrorResponse(res, 500, "CREATE_BULK_ORDER_ERROR", error.message || "Something went wrong");
    }
};

export const getBulkOrderChallan = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid orderId");
        }

        const bulkOrder = await BulkOrder.findById(orderId).lean();

        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Bulk order not found");
        }

        const customer = await Customer.findById(bulkOrder.customer.customerId).lean();

        const challanHTML = generateDeliveryChallanHTML({
            billNumber: bulkOrder.orders[0]?.orderNumber,
            orderDate: bulkOrder.createdAt,
            deliveryDate: bulkOrder.createdAt,
            companyName: process.env.COMPANY_NAME || "DigiOptics",
            companyAddress: process.env.COMPANY_ADDRESS || "Delhi",
            companyEmail: process.env.COMPANY_EMAIL || "sid@digibysr.com",
            companyPhone: process.env.COMPANY_PHONE || "+91 9650560526",
            companyGstin: process.env.COMPANY_GSTIN || "GST9876543210",
            customerName: bulkOrder.customer.customerName,
            customerAddress: bulkOrder.customer.customerShipToBranchName || customer?.billToAddress?.address || "",
            customerPhone: customer?.mobileNo1 || "",
            orders: bulkOrder.orders,
        });

        const pdfBuffer = await generatePDF(challanHTML);
        const fileName = `challan-${bulkOrder.orders[0]?.orderNumber || orderId}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.end(pdfBuffer);
    } catch (error) {
        console.error("Get Bulk Order Challan Error:", error);
        return sendErrorResponse(res, 500, "CHALLAN_ERROR", error.message || "Something went wrong");
    }
};

export const getBulkOrderInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid orderId");
        }

        const bulkOrder = await BulkOrder.findById(orderId).lean();

        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Bulk order not found");
        }

        const customer = await Customer.findById(bulkOrder.customer.customerId).lean();

        const buildMaterialDescription = (item) => {
            let desc = item.itemName || "";

            const fmtVal = (v) => (v !== undefined && v !== null && v !== "" ? v : "0.00");

            if (item.orderType === "RX" && item.rx?.powers?.length) {
                const rPower = item.rx.powers.find((p) => p.side === "R");
                const lPower = item.rx.powers.find((p) => p.side === "L");
                if (rPower) {
                    desc += `<br/>Side : R ( SPH : ${fmtVal(rPower.sph)}, CYL : ${fmtVal(rPower.cyl)},<br/>AXIS : ${fmtVal(rPower.axis)}, ADD : ${fmtVal(rPower.add)} )`;
                }
                if (lPower) {
                    desc += `<br/>Side : L ( SPH : ${fmtVal(lPower.sph)}, CYL : ${fmtVal(lPower.cyl)},<br/>AXIS : ${fmtVal(lPower.axis)}, ADD : ${fmtVal(lPower.add)} ) - ( ${fmtVal(item.price)} / pc )`;
                }
                desc += `<br/>Tint : ${item.rx?.tint?.name || "No Tint"} ( ${fmtVal(item.rx?.tintValue ?? 0.00)} )`;
            } else if (item.sph !== undefined || item.cyl !== undefined) {
                desc += `<br/>Side : R ( SPH : ${fmtVal(item.sph)}, CYL : ${fmtVal(item.cyl)}, AXIS : ${fmtVal(item.axis)}, ADD : ${fmtVal(item.add)} )`;
                desc += `<br/>Side : L ( SPH : ${fmtVal(item.sph)}, CYL : ${fmtVal(item.cyl)}, AXIS : ${fmtVal(item.axis)}, ADD : ${fmtVal(item.add)} ) - ( ${fmtVal(item.price)} / pc )`;
                desc += `<br/>Tint : ${item.tint || "No Tint"} ( 0.00 )`;
            }

            return desc;
        };

        const allItems = bulkOrder.orders.flatMap((order) =>
            order.items.map((item) => {
                const price = item.price || 0;
                const qty = item.qty || 0;
                const value = price * qty;
                const discount = item.discountPercent || 0;
                const netValue = discount ? value * (1 - discount / 100) : value;

                return {
                    orderNo: order.orderNumber || "",
                    dcNo: "",
                    orderDate: new Date(order.createdAt || bulkOrder.createdAt).toLocaleDateString("en-IN"),
                    referenceNo: item.code || "",
                    materialDescription: buildMaterialDescription(item),
                    hsn: item.hsnSac || "",
                    quantity: qty,
                    unitRate: price,
                    value,
                    discount,
                    netValue,
                };
            })
        );

        // const totalQty      = allItems.reduce((sum, i) => sum + Number(i.quantity), 0);
        // const grossAmount   = allItems.reduce((sum, i) => sum + Number(i.value), 0);
        // const discountAmount = allItems.reduce((sum, i) => sum + (Number(i.value) - Number(i.netValue)), 0);
        // const taxableAmount = grossAmount - discountAmount;

        const totals = allItems.reduce( (acc, item) => {
                acc.qty += Number(item.quantity);
                acc.gross += Number(item.value);
                acc.discount +=
                    Number(item.value) -
                    Number(item.netValue);
                return acc;
            }, {
                qty: 0,
                gross: 0,
                discount: 0,
            });

        const totalQty = totals.qty;
        const grossAmount = totals.gross;
        const discountAmount = totals.discount;
        const taxableAmount = grossAmount - discountAmount;

        const cgstAmount = bulkOrder.orders.reduce((sum, o) => sum + (parseFloat(o.cgst) || 0), 0);
        const sgstAmount = bulkOrder.orders.reduce((sum, o) => sum + (parseFloat(o.sgst) || 0), 0);
        const grandTotal = taxableAmount + cgstAmount + sgstAmount;

        const billTo = customer?.billToAddress || {};

        const shipToAddress = bulkOrder.customer.customerShipToId
            ? customer?.customerShipToDetails?.find(
                (s) => s._id.toString() === bulkOrder.customer.customerShipToId.toString()
            )
            : null;
        const shipTo = shipToAddress || billTo;

        const invoiceHTML = generatedorderInvoice({
            invoiceNo: bulkOrder.orders[0]?.orderNumber || orderId,
            invoiceDate: new Date(bulkOrder.createdAt).toLocaleDateString("en-IN"),
            irnNo: "",
            placeOfSupply: billTo.state || "",
            company: {
                name: process.env.COMPANY_NAME || "DigiOptics",
                addressLine1: process.env.COMPANY_ADDRESS || "Delhi",
                addressLine2: "",
                city: "",
                gstin: process.env.COMPANY_GSTIN || "GST9876543210",
                stateCode: "",
            },
            billTo: {
                name: bulkOrder.customer.customerName,
                branchName: billTo.branchName || "",
                contactName: billTo.customerContactName || "",
                contactNumber: billTo.customerContactNumber || "",
                address: billTo.address || "",
                state: billTo.state || "",
                city: billTo.city || "",
                pincode: billTo.zipCode || "",
                gstin: customer?.gstNumber || "",
            },
            shipTo: {
                name: bulkOrder.customer.customerShipToBranchName || bulkOrder.customer.customerName,
                branchName: shipTo.branchName || "",
                contactName: shipTo.customerContactName || "",
                contactNumber: shipTo.customerContactNumber || "",
                address: shipTo.address || "",
                state: shipTo.state || "",
                city: shipTo.city || "",
                pincode: shipTo.zipCode || "",
            },
            items: allItems,
            totalQty,
            grossAmount: grossAmount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            taxableAmount: taxableAmount.toFixed(2),
            cgstAmount,
            sgstAmount,
            igstAmount: 0,
            grandTotal: grandTotal.toFixed(2),
        });

        const pdfBuffer = await generatePDF(invoiceHTML);
        const fileName = `invoice-${bulkOrder.orders[0]?.orderNumber || orderId}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.end(pdfBuffer);
    } catch (error) {
        console.error("Get Bulk Order Invoice Error:", error);
        return sendErrorResponse(res, 500, "INVOICE_ERROR", error.message || "Something went wrong");
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderNumber, status, remarks } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid orderId");
        }

        const VALID_STATUSES = [
            "Draft", "Submitted", "Processing",
            "QC", "ReadyToDispatch", "Dispatched", "Delivered",
            "Completed", "Cancelled",
        ];

        const ALLOWED_TRANSITIONS = {
            "Draft": ["Submitted", "Cancelled"],
            "Submitted": ["Processing", "Cancelled"],
            "Processing": ["QC", "Cancelled"],
            "QC": ["ReadyToDispatch", "Cancelled"],
            "ReadyToDispatch": ["Dispatched", "Cancelled"],
            "Dispatched": ["Delivered", "Cancelled"],
            "Delivered": ["Completed"],
            "Completed": [],
            "Cancelled": [],
        };

        if (!status || !VALID_STATUSES.includes(status)) {
            return sendErrorResponse(res, 400, "INVALID_STATUS", `Status must be one of: ${VALID_STATUSES.join(", ")}`);
        }

        const bulkOrder = await BulkOrder.findById(orderId);
        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Bulk order not found");
        }

        const ordersToUpdate = orderNumber
            ? bulkOrder.orders.filter(o => o.orderNumber === orderNumber)
            : bulkOrder.orders;

        if (orderNumber && ordersToUpdate.length === 0) {
            return sendErrorResponse(res, 404, "ORDER_NOT_FOUND", `Order number ${orderNumber} not found in this bulk order`);
        }

        for (const order of ordersToUpdate) {
            const allowed = ALLOWED_TRANSITIONS[order.status] || [];
            if (!allowed.includes(status)) {
                return sendErrorResponse(
                    res, 400, "INVALID_TRANSITION",
                    `Order "${order.orderNumber}" cannot move from "${order.status}" to "${status}". Allowed next: ${allowed.length ? allowed.join(", ") : "none"}`
                );
            }
            order.status = status;
        }

        await bulkOrder.save();

        return sendSuccessResponse(res, 200, { bulkOrder }, `Order status updated to ${status}`);
    } catch (error) {
        console.error("Update Order Status Error:", error);
        return sendErrorResponse(res, 500, "UPDATE_STATUS_ERROR", error.message || "Something went wrong");
    }
};

export const updateBulkDraftOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { orders, customerShipToId, submitNow } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid order ID");
        }

        const bulkOrder = await BulkOrder.findById(id);
        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Order not found");
        }

        const canUpdate = bulkOrder.orders.every(o => ["Draft", "Submitted"].includes(o.status));
        if (!canUpdate) {
            return sendErrorResponse(res, 400, "INVALID_STATUS", "Only Draft or Submitted orders can be updateddd");
        }

        if (customerShipToId) {
            const customer = await Customer.findById(bulkOrder.customer.customerId).lean();
            if (customer) {
                const shipTo = customer.customerShipToDetails?.find(
                    s => s._id.toString() === customerShipToId.toString()
                );
                if (!shipTo) {
                    return sendErrorResponse(res, 404, "NOT_FOUND", "Ship-to address not found for this customer");
                }
                bulkOrder.customer.customerShipToId = shipTo._id;
                bulkOrder.customer.customerShipToBranchName = shipTo.branchName;
            }
        }

        if (Array.isArray(orders) && orders.length > 0) {
            const allProductIds = orders
                .flatMap(o => o.items || [])
                .filter(item => item.productId)
                .map(item => item.productId.toString());

            let productMap = {};
            if (allProductIds.length > 0) {
                const products = await DigiProduct.find({ _id: { $in: allProductIds } }).lean();
                productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));
            }

            bulkOrder.orders = orders.map(incomingOrder => {
                const existing = bulkOrder.orders.find(o => o.orderNumber === incomingOrder.orderNumber);
                const items = (incomingOrder.items || []).map(item => {
                    const product = productMap[item.productId?.toString()];
                    return {
                        ...(item),
                        itemName: item.itemName || product?.productName || "",
                        category: (item.category || product?.category || "").toUpperCase(),
                        price: item.price ?? product?.price ?? 0,
                        mrp: item.mrp ?? product?.mrp ?? 0,
                        gst: item.gst ?? product?.gst ?? 0,
                        hsnSac: item.hsnSac || product?.hsnSac || "",
                        qty: Number(item.qty || 0),
                    };
                });

                return {
                    orderNumber: existing?.orderNumber || incomingOrder.orderNumber || generateOrderNumber(),
                    items,
                    cgst: incomingOrder.cgst !== undefined ? String(incomingOrder.cgst) : (existing?.cgst || "0"),
                    sgst: incomingOrder.sgst !== undefined ? String(incomingOrder.sgst) : (existing?.sgst || "0"),
                    status: submitNow ? "Submitted" : "Draft",
                    remarks: incomingOrder.remarks || existing?.remarks || "",
                };
            });
        } else if (submitNow) {
            for (const order of bulkOrder.orders) {
                order.status = "Submitted";
            }
        }

        await bulkOrder.save();

        if (submitNow) {
            const customer = await Customer.findById(bulkOrder.customer.customerId).lean();
            if (customer) {
                handleOrderBillingNotification({ bulkOrder, customer }).catch(err =>
                    console.error("Billing notification error:", err.message)
                );
            }
        }

        return sendSuccessResponse(
            res, 200, { bulkOrder },
            submitNow ? "Draft order submitted successfully" : "Draft order updated successfully"
        );
    } catch (error) {
        console.error("Update Bulk Draft Order Error:", error);
        return sendErrorResponse(res, 500, "UPDATE_DRAFT_ERROR", error.message || "Something went wrong");
    }
};
