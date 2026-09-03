import mongoose from "mongoose";
import Customer from "../../../../models/Auth/Customer.js";
import CustomerLedger from "../../../../models/Accounting/CustomerLedger.model.js";
import LedgerTransaction from "../../../../models/Accounting/LedgerTransaction.model.js";
import BulkOrder from "../../../../models/order/BulkOrder.js";
import DigiProduct from "../../../../models/Product/Product.model.js";
import Vendor from "../../../../models/Vendor.model.js";
import VendorPurchase from "../../../../models/Purchase/VendorPurchase.model.js";
import Employee from "../../../../models/Auth/Employee.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../../Utils/response/responseHandler.js";
import { sendEmail } from "../../../config/Email/emailService.js";
import VendorRxOrderTemplate from "../../../../Utils/Mail/VendorRxOrderTemplate.js";
import { handleOrderBillingNotification } from "../../../services/billing/billingNotification.service.js";
import { sendWhatsAppMessage } from "../../../../Utils/whatsapp/whatsappService.js";
import { generateLowStockExcel } from "../../../../Utils/excel/generateLowStockExcel.js";
import { generatePurchaseOrderExcel } from "../../../../Utils/excel/generatePurchaseOrderExcel.js";
import { generateAndStoreChallan, generateAndStoreInvoice, invalidatePDFs } from "../../../services/pdfStorageService.js";
import { applyPurchaseToVendorLedger } from "../../Purchase/purchase.controller.js";

const sendLowStockAlerts = async ({ orders, productMap, customerName, orderNumber }) => {
    try {
        const lowStockItems = [];

        for (const order of orders) {
            for (const item of order.items) {
                const product = productMap[item.productId?.toString()];
                if (!product) continue;

                const orderedQty   = Number(item.qty || 0);
                const availableQty = Number(product.qty ?? 0);

                if (availableQty < orderedQty) {
                    lowStockItems.push({
                        productName:   product.productName  || product.productCode || "",
                        productCode:   product.productCode  || "",
                        category:      product.category     || "",
                        brand:         product.brand        || "",
                        unit:          product.unit         || item.unit || "",
                        orderedQty,
                        availableQty,
                        shortfall:     orderedQty - availableQty,
                        price:         product.price        ?? 0,
                        mrp:           product.mrp          ?? 0,
                        gst:           product.gst          ?? 0,
                        hsnSac:        product.hsnSac       || "",
                        index:         product.index        ?? "",
                        coating:       product.coating      || "",
                        tint:          product.tint         || "",
                        sph:           product.sph          ?? "",
                        cyl:           product.cyl          ?? "",
                        axis:          product.axis         ?? "",
                        add:           product.add          ?? "",
                        color:         product.color        || "",
                        size:          product.size         || "",
                        shape:         product.shape        || "",
                        material:      product.material     || "",
                        dimensions:    product.dimensions   || "",
                        expiry:        product.expiry       || "",
                        disposability: product.disposability|| "",
                    });
                }
            }
        }

        if (lowStockItems.length === 0) return;

        const staff = await Employee.find({
            EmployeeType: { $in: ["SUPERADMIN", "ADMIN"] },
            isActive:  true,
            isDeleted: false,
            email:     { $exists: true, $ne: "" },
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
                to:      s.email,
                subject: `⚠️ Low Stock Alert — Order ${orderNumber} from ${customerName}`,
                html,
                attachments: [{
                    name:    `LowStock-${orderNumber}.xlsx`,
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

const FRAME_SUNGLASS_CATEGORIES = ["FRAME", "SUNGLASS"];
const LENS_CATEGORIES           = ["LENS", "CONTACT_LENS"];

const generateOrderNumber = () => `BO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const createRxVendorPurchaseOrders = async ({ bulkOrder, tenantId, createdBy }) => {
    try {
        const vendorItemsMap = new Map();

        for (const order of bulkOrder.orders) {
            for (const item of order.items) {
                if (item.orderType !== "RX" || !item.rx?.vendor?.id) continue;

                const vendorId   = item.rx.vendor.id.toString();
                const vendorName = item.rx.vendor.name;

                if (!vendorItemsMap.has(vendorId)) {
                    vendorItemsMap.set(vendorId, { vendorId, vendorName, items: [], orderNumber: order.orderNumber, cgst: order.cgst, sgst: order.sgst });
                }
                vendorItemsMap.get(vendorId).items.push({
                    productId:    item.productId   || null,
                    isNewProduct: !item.productId,
                    orderType:    "RX",
                    itemName:     item.itemName    || "",
                    category:     item.category    || "LENS",
                    unit:         item.unit        || "PIECE",
                    brand:        item.brand       || "",
                    code:         item.code        || "",
                    price:        item.price       ?? 0,
                    mrp:          item.mrp         ?? 0,
                    gst:          item.gst         ?? 0,
                    hsnSac:       item.hsnSac      || "",
                    qty:          item.qty         ?? 1,
                    sph:          item.sph,
                    cyl:          item.cyl,
                    axis:         item.axis,
                    add:          item.add,
                    index:        item.index,
                    tint:         item.tint        || "",
                    coating:      item.coating     || "",
                    discountPercent: item.discountPercent ?? 0,
                    discountAmount:  item.discountAmount  ?? 0,
                    inwardStatus: "PENDING",
                    qcStatus:     "PENDING",
                    rx: {
                        vendor:     item.rx.vendor,
                        lab:        item.rx.lab,
                        coating:    item.rx.coating,
                        treatment:  item.rx.treatment,
                        tint:       item.rx.tint,
                        powers:     item.rx.powers     || [],
                        prisms:     item.rx.prisms     || [],
                        centration: item.rx.centration || [],
                        resolved:   item.rx.resolved   || [],
                        fitting:    item.rx.fitting    || {},
                        lensData:   item.rx.lensData   || {},
                        remarks:    item.rx.remarks    || "",
                    },
                });
            }
        }

        if (vendorItemsMap.size === 0) return;

        const vendorIds = [...vendorItemsMap.keys()].filter(id => mongoose.Types.ObjectId.isValid(id));
        const vendors   = await Vendor.find({ _id: { $in: vendorIds } }).lean();
        const vendorMap = new Map(vendors.map(v => [v._id.toString(), v]));

        const poCreations = [];

        for (const [vendorId, { vendorName, items, orderNumber, cgst, sgst }] of vendorItemsMap) {
            const vendor = vendorMap.get(vendorId);
            if (!vendor) {
                console.warn(`[RX-PO] Vendor ${vendorId} not found in DB — skipping`);
                continue;
            }

            poCreations.push(VendorPurchase.create({
                vendor: {
                    vendorId:   vendor._id,
                    vendorName: vendor.name,
                    email:      vendor.email    || "",
                    mobile:     vendor.mobile   || "",
                    address:    vendor.address  || "",
                    gstNumber:  vendor.gstNumber || "",
                },
                orders: [{
                    orderNumber: `RX-${orderNumber}-${vendorId.slice(-4).toUpperCase()}`,
                    items,
                    cgst: cgst || "0",
                    sgst: sgst || "0",
                    status: "Submitted",
                }],
                createdBy,
                tenantId,
                sourceCustomerOrderId: bulkOrder._id,
            }));
        }

        const created = await Promise.all(poCreations);
        console.log(`[RX-PO] Created ${created.length} vendor purchase order(s) for RX items`);

        for (const po of created) {
            await applyPurchaseToVendorLedger({
                vendorPurchase: po,
                vendorId: po.vendor.vendorId,
                userId: createdBy,
                tenantId,
            }).catch(err => console.error("[RX-PO] Vendor ledger sync error:", err.message));
        }
    } catch (err) {
        console.error("[RX-PO] Auto vendor PO creation error:", err.message);
    }
};

const createStockVendorPurchaseOrders = async ({ bulkOrder, tenantId, createdBy }) => {
    try {
        const vendorItemsMap = new Map();

        for (const order of bulkOrder.orders) {
            for (const item of order.items) {
                if (item.orderType !== "STOCK") continue;
                if (!item.vendor?.id) continue;

                const vendorId   = item.vendor.id.toString();
                const vendorName = item.vendor.name;

                if (!mongoose.Types.ObjectId.isValid(vendorId)) continue;

                if (!vendorItemsMap.has(vendorId)) {
                    vendorItemsMap.set(vendorId, {
                        vendorId,
                        vendorName,
                        items:       [],
                        orderNumber: order.orderNumber,
                        cgst:        order.cgst,
                        sgst:        order.sgst,
                    });
                }

                vendorItemsMap.get(vendorId).items.push({
                    productId:       item.productId   || null,
                    isNewProduct:    false,
                    orderType:       "STOCK",
                    itemName:        item.itemName    || "",
                    category:        item.category    || "",
                    unit:            item.unit        || "PIECE",
                    brand:           item.brand       || "",
                    code:            item.code        || "",
                    color:           item.color       || "",
                    size:            item.size        || "",
                    shape:           item.shape       || "",
                    material:        item.material    || "",
                    dimensions:      item.dimensions  || "",
                    price:           item.price       ?? 0,
                    mrp:             item.mrp         ?? 0,
                    gst:             item.gst         ?? 0,
                    hsnSac:          item.hsnSac      || "",
                    qty:             item.qty         ?? 1,
                    sph:             item.sph,
                    cyl:             item.cyl,
                    axis:            item.axis,
                    add:             item.add,
                    index:           item.index,
                    tint:            item.tint        || "",
                    coating:         item.coating     || "",
                    discountPercent: item.discountPercent ?? 0,
                    discountAmount:  item.discountAmount  ?? 0,
                    inwardStatus:    "PENDING",
                    qcStatus:        "PENDING",
                });
            }
        }

        if (vendorItemsMap.size === 0) return;

        const vendorIds = [...vendorItemsMap.keys()];
        const vendors   = await Vendor.find({ _id: { $in: vendorIds } }).lean();
        const vendorMap = new Map(vendors.map(v => [v._id.toString(), v]));

        const poCreations = [];

        for (const [vendorId, { vendorName, items, orderNumber, cgst, sgst }] of vendorItemsMap) {
            const vendor = vendorMap.get(vendorId);
            if (!vendor) {
                console.warn(`[STOCK-PO] Vendor ${vendorId} not found — skipping`);
                continue;
            }

            poCreations.push(VendorPurchase.create({
                vendor: {
                    vendorId:   vendor._id,
                    vendorName: vendor.name,
                    email:      vendor.email     || "",
                    mobile:     vendor.mobile    || "",
                    address:    vendor.address   || "",
                    gstNumber:  vendor.gstNumber || "",
                },
                orders: [{
                    orderNumber: `STOCK-${orderNumber}-${vendorId.slice(-4).toUpperCase()}`,
                    items,
                    cgst: cgst || "0",
                    sgst: sgst || "0",
                    status: "Submitted",
                }],
                createdBy,
                tenantId,
                sourceCustomerOrderId: bulkOrder._id,
            }));
        }

        const created = await Promise.all(poCreations);
        console.log(`[STOCK-PO] Created ${created.length} vendor purchase order(s) for STOCK items`);

        for (const po of created) {
            await applyPurchaseToVendorLedger({
                vendorPurchase: po,
                vendorId: po.vendor.vendorId,
                userId: createdBy,
                tenantId,
            }).catch(err => console.error("[STOCK-PO] Vendor ledger sync error:", err.message));
        }
    } catch (err) {
        console.error("[STOCK-PO] Auto vendor PO creation error:", err.message);
    }
};

const sendVendorRxOrderEmails = async ({ bulkOrder, customer }) => {
    try {
        const vendorItemsMap = new Map();

        for (const order of bulkOrder.orders) {
            for (const item of order.items) {
                if (item.orderType !== "RX") continue;

                const vendorId   = item.rx?.vendor?.id?.toString();
                const vendorName = item.rx?.vendor?.name;

                if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
                    console.warn(`[RX-EMAIL] Skipping item "${item.itemName}" — missing or invalid vendor id: ${vendorId}`);
                    continue;
                }

                if (!vendorItemsMap.has(vendorId)) {
                    vendorItemsMap.set(vendorId, { vendorName, items: [] });
                }
                vendorItemsMap.get(vendorId).items.push(item);
            }
        }



        const vendorIds = [...vendorItemsMap.keys()];
        const vendors   = await Vendor.find({ _id: { $in: vendorIds } }).lean();
        const vendorContactMap = new Map(vendors.map(v => [v._id.toString(), { email: v.email, mobile: v.mobile, name: v.name }]));

        const orderDate   = new Date(bulkOrder.createdAt).toLocaleDateString("en-IN");
        const orderNumber = bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString();
        const shipTo      = bulkOrder.customer.customerShipToBranchName || bulkOrder.customer.customerName;

        const emailPromises = [];

        for (const [vendorId, { vendorName, items }] of vendorItemsMap) {
            const vendorContact = vendorContactMap.get(vendorId);

            if (!vendorContact) {
                console.warn(`[RX-EMAIL] Vendor ${vendorId} (${vendorName}) not found in DB — skipping`);
                continue;
            }

            if (!vendorContact.email) {
                console.warn(`[RX-EMAIL] Vendor ${vendorId} (${vendorName}) has no email — skipping email`);
            } else {
                const html = VendorRxOrderTemplate({
                    vendorName:  vendorContact.name || vendorName,
                    orderNumber,
                    orderDate,
                    customer: {
                        name:  customer.ownerName || customer.shopName,
                        phone: customer.mobileNo1 || "",
                    },
                    shipTo,
                    items,
                });

                const vendorPO = await VendorPurchase.findOne({
                    sourceCustomerOrderId: bulkOrder._id,
                    "vendor.vendorId": vendorId,
                }).lean();

                const attachments = [];
                if (vendorPO) {
                    try {
                        const excelBuffer = generatePurchaseOrderExcel(vendorPO);
                        attachments.push({
                            name:    `RX-Order-${orderNumber}.xlsx`,
                            content: excelBuffer.toString("base64"),
                        });
                    } catch (excelErr) {
                        console.error(`[RX-EMAIL] Excel generation failed for vendor ${vendorId}:`, excelErr.message);
                    }
                }

                console.log(`[RX-EMAIL] Sending RX order email to vendor: ${vendorContact.email}`);

                emailPromises.push(
                    sendEmail({
                        to:          vendorContact.email,
                        subject:     `RX Order ${orderNumber} — DigiOptics`,
                        html,
                        attachments,
                    }).then(result => {
                        if (result.success) {
                            console.log(`[RX-EMAIL] Email sent successfully to vendor ${vendorContact.email}`);
                        } else {
                            console.error(`[RX-EMAIL] Email failed for vendor ${vendorContact.email}`);
                        }
                    }).catch(err => console.error(`[RX-EMAIL] Email error for vendor ${vendorId}:`, err.message))
                );
            }

            if (vendorContact.mobile) {
                const whatsappMsg = `Hello ${vendorContact.name || vendorName} 👋,

A new *RX Order* has been assigned to you on *DigiOptics Wholesale*.

*Order Details:*
• Order Number: ${orderNumber}
• Order Date: ${orderDate}
• Customer: ${customer.ownerName || customer.shopName}
• Total RX Items: ${items.length}

Please check your email for complete RX specifications and lens details.

Thank you,
*DigiOptics Wholesale Team*`;

                emailPromises.push(
                    sendWhatsAppMessage({ to: vendorContact.mobile, message: whatsappMsg })
                        .catch(err => console.error(`[RX-EMAIL] WhatsApp error for vendor ${vendorId}:`, err.message))
                );
            }
        }

        await Promise.all(emailPromises);
        console.log(`[RX-EMAIL] Vendor notifications dispatched for ${vendorItemsMap.size} vendor(s)`);
    } catch (err) {
        console.error("[RX-EMAIL] sendVendorRxOrderEmails error:", err.message);
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


/**
 * Helper to automatically apply credit limit validation, creditUsed addition,
 * and ledger transaction entry on new confirmed order.
 */
export const applyOrderToCustomerCreditAndLedger = async ({ bulkOrder, customerId, userId, tenantId, reqBody }) => {
    try {
        const freshCustomer = await Customer.findById(customerId);
        if (!freshCustomer) return;

        let grandTotal = 0;
        if (reqBody?.grossTotalWithCharges && Number(reqBody.grossTotalWithCharges) > 0) {
            grandTotal = Number(reqBody.grossTotalWithCharges);
        } else if (reqBody?.grossTotal && Number(reqBody.grossTotal) > 0) {
            grandTotal = Number(reqBody.grossTotal) + Number(bulkOrder.shippingCharges || 0) + Number(bulkOrder.otherCharges || 0);
        } else {
            let subtotal = 0;
            let totalGst = 0;
            for (const ord of bulkOrder.orders) {
                if (ord.grossTotalWithCharges && Number(ord.grossTotalWithCharges) > 0) {
                    grandTotal += Number(ord.grossTotalWithCharges);
                } else if (ord.totalOrderPrice && Number(ord.totalOrderPrice) > 0) {
                    grandTotal += Number(ord.totalOrderPrice);
                } else if (Array.isArray(ord.items)) {
                    for (const it of ord.items) {
                        const price = Number(it.price || 0);
                        const qty = Number(it.qty || 1);
                        const discount = Number(it.discountAmount || 0);
                        const taxable = Math.max(0, (price * qty) - discount);
                        const gst = Number(it.gst || 0);
                        subtotal += taxable;
                        totalGst += taxable * (gst / 100);
                    }
                }
            }
            if (grandTotal === 0) {
                grandTotal = subtotal + totalGst + Number(bulkOrder.shippingCharges || 0) + Number(bulkOrder.otherCharges || 0);
            }
        }

        const advancePaid = Number(bulkOrder.advanceAmount || reqBody?.advanceAmount || 0);

        const existingCreditUsed = Number(freshCustomer.creditUsed || 0);
        const existingAdvance = Number(freshCustomer.customerBalance || 0);

        const unpaidAmount = Math.max(0, grandTotal - advancePaid);
        let absorbedFromAdvance = 0;
        let remainingAdvance = existingAdvance;
        let newCreditUsedToAdd = 0;

        if (unpaidAmount > 0) {
            if (existingAdvance > 0) {
                absorbedFromAdvance = Math.min(unpaidAmount, existingAdvance);
                remainingAdvance = existingAdvance - absorbedFromAdvance;
                newCreditUsedToAdd = unpaidAmount - absorbedFromAdvance;
            } else {
                newCreditUsedToAdd = unpaidAmount;
            }
        } else {
            const excess = advancePaid - grandTotal;
            remainingAdvance = existingAdvance + Math.max(0, excess);
            newCreditUsedToAdd = 0;
        }

        const finalCreditUsed = existingCreditUsed + newCreditUsedToAdd;
        const finalBalance = finalCreditUsed > 0 ? finalCreditUsed : -remainingAdvance;

        // 1. Update Customer Model in MongoDB
        await Customer.findByIdAndUpdate(freshCustomer._id, {
            $set: {
                creditUsed: finalCreditUsed,
                customerBalance: remainingAdvance
            }
        });

        // 2. Update or create Customer Ledger
        let ledger = await CustomerLedger.findOne({ customerId: freshCustomer._id });
        if (!ledger) {
            ledger = new CustomerLedger({
                ledgerCode: `CUST-LED-${freshCustomer._id.toString().slice(-6).toUpperCase()}`,
                customerId: freshCustomer._id,
                creditLimit: Number(freshCustomer.creditLimit || 0),
                creditDays: Number(freshCustomer.creditDays || 30),
                creditUsed: finalCreditUsed,
                advanceAmount: remainingAdvance,
                currentBalance: finalBalance,
                branchId: freshCustomer.branchId || null,
                tenantId,
                createdBy: userId
            });
        } else {
            ledger.creditUsed = finalCreditUsed;
            ledger.advanceAmount = remainingAdvance;
            ledger.currentBalance = finalBalance;
        }
        await ledger.save();

        // 3. Post Sales Invoice in LedgerTransaction
        const orderRef = bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString();
        await LedgerTransaction.create([{
            entityType: 'Customer',
            ledgerId: ledger._id,
            partyId: freshCustomer._id,
            transactionDate: new Date(),
            voucherType: 'Sales Invoice',
            voucherId: bulkOrder._id,
            referenceNumber: orderRef,
            debit: grandTotal,
            credit: advancePaid + absorbedFromAdvance,
            runningBalance: finalBalance,
            narration: `Sales Invoice for Order #${orderRef}. Total: ₹${grandTotal.toLocaleString()}, Advance Paid: ₹${advancePaid.toLocaleString()}${absorbedFromAdvance > 0 ? (', Absorbed from Advance: ₹' + absorbedFromAdvance.toLocaleString()) : ''}, Added to Credit Used: ₹${newCreditUsedToAdd.toLocaleString()}`,
            branchId: ledger.branchId || null,
            tenantId,
            createdBy: userId
        }]);

        console.log(`[Order Credit Sync Complete] Order #${orderRef}: GrandTotal=₹${grandTotal}, AdvancePaid=₹${advancePaid}, AbsorbedAdv=₹${absorbedFromAdvance}, AddedToCredit=₹${newCreditUsedToAdd}, NewCreditUsed=₹${finalCreditUsed}, AdvanceBalance=₹${remainingAdvance}`);
    } catch (err) {
        console.error("[Order Credit Sync Error]:", err.message);
    }
};

export const revertOrderCreditOnCancellation = async ({ bulkOrder, customerId, cancelledOrders, userId, tenantId }) => {
    try {
        let cancelledTotal = 0;
        for (const ord of cancelledOrders) {
            if (ord.totalOrderPrice !== undefined && ord.totalOrderPrice !== null) {
                cancelledTotal += Number(ord.totalOrderPrice);
            } else if (Array.isArray(ord.items)) {
                cancelledTotal += ord.items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 1)), 0);
            }
        }

        if (cancelledTotal <= 0) return;

        const customer = await Customer.findById(customerId);
        if (!customer) return;

        const currentCreditUsed = Number(customer.creditUsed || 0);
        const newCreditUsed = Math.max(0, currentCreditUsed - cancelledTotal);
        const newBalance = newCreditUsed > 0 ? newCreditUsed : -(customer.customerBalance || 0);

        await Customer.findByIdAndUpdate(customerId, {
            $set: { creditUsed: newCreditUsed }
        });

        const ledger = await CustomerLedger.findOne({ customerId });
        if (ledger) {
            ledger.creditUsed = newCreditUsed;
            ledger.currentBalance = newBalance;
            await ledger.save();

            const orderRef = cancelledOrders[0]?.orderNumber || bulkOrder._id.toString();
            await LedgerTransaction.create([{
                entityType: 'Customer',
                ledgerId: ledger._id,
                partyId: customerId,
                transactionDate: new Date(),
                voucherType: 'Credit Note',
                voucherId: bulkOrder._id,
                referenceNumber: `CN-${orderRef}`,
                debit: 0,
                credit: cancelledTotal,
                runningBalance: newBalance,
                narration: `Order #${orderRef} Cancelled. Reversed ₹${cancelledTotal.toLocaleString()} from Credit Used.`,
                branchId: ledger.branchId || null,
                tenantId,
                createdBy: userId
            }]);
        }
    } catch (err) {
        console.error("[Order Cancellation Reversal Error]:", err.message);
    }
};

export const createBulkOrder = async (req, res) => {
    try {
        const { customerId, customerShipToId, orders, isDraft, advanceAmount, shippingCharges, otherCharges } = req.body;

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

        const customer = await Customer.findOne({ _id: customerId, tenantId: req.user.tenantId });

        if (!customer) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Customer not found");
        }

        if (customer.status?.isSuspended) {
            return sendErrorResponse(res, 403, "CUSTOMER_SUSPENDED", "Customer account is suspended");
        }

        if (customer.isBlacklisted) {
            return sendErrorResponse(res, 403, "CUSTOMER_BLACKLISTED", "Customer is blacklisted");
        }

        let shipToBranchName  = null;
        let resolvedShipToId  = null;

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
                if (item.orderType !== "RX" && !item.productId) {
                    return sendErrorResponse(res, 400, "VALIDATION_ERROR", "productId is required for STOCK items");
                }
                if (item.productId && !mongoose.Types.ObjectId.isValid(item.productId)) {
                    return sendErrorResponse(res, 400, "INVALID_PRODUCT_ID", `Invalid productId: ${item.productId}`);
                }
                if (item.productId) {
                    allProductIds.push(item.productId.toString());
                }
            }
        }

        const products = await DigiProduct.find({ _id: { $in: allProductIds } }).lean();
        const productMap = {};
        products.forEach((p) => { productMap[p._id.toString()] = p; });

        const uniqueProductIds = [...new Set(allProductIds)];
        const foundIds         = products.map((p) => p._id.toString());
        const missingProducts  = uniqueProductIds.filter((id) => !foundIds.includes(id));

        if (missingProducts.length > 0) {
            return sendErrorResponse(res, 404, "PRODUCT_NOT_FOUND", `Products not found: ${missingProducts.join(", ")}`);
        }

        for (const order of orders) {
            for (const item of order.items) {
                const product = item.productId ? productMap[item.productId.toString()] : null;

                if (item.orderType !== "RX" && !product) {
                    return sendErrorResponse(res, 404, "PRODUCT_NOT_FOUND", `Product not found: ${item.productId}`);
                }

                const qty = Number(item.qty);

                if (!qty || qty <= 0) {
                    return sendErrorResponse(res, 400, "INVALID_QUANTITY", `Quantity must be greater than 0 for ${item.itemName || item.productId}`);
                }

                const rawCategory     = (item.category || product?.category || "").toUpperCase();
                const validationError = validateItemByCategory(item, product);

                if (validationError) {
                    return sendErrorResponse(res, 400, "VALIDATION_ERROR", `${validationError}. Product: ${item.itemName || item.productId}`);
                }

                if (item.orderType === "STOCK") {
                    delete item.rx;
                }

                item.itemName = item.itemName || product?.productName;
                item.category = rawCategory;
                item.price    = item.price  ?? product?.price ?? 0;
                item.mrp      = item.mrp    ?? product?.mrp   ?? 0;
                item.gst      = item.gst    ?? product?.gst   ?? 0;
                item.hsnSac   = item.hsnSac || product?.hsnSac;
                item.qty      = qty;
                item.photos   = Array.isArray(item.photos) ? item.photos : [];

                if (FRAME_SUNGLASS_CATEGORIES.includes(rawCategory)) {
                    item.code        = item.code        || product?.productCode;
                    item.brand       = item.brand       || product?.brand;
                    item.color       = item.color       || product?.color;
                    item.size        = item.size        || product?.size;
                    item.type        = item.type        || product?.type;
                    item.shape       = item.shape       || product?.shape;
                    item.material    = item.material    || product?.material;
                    item.dimensions  = item.dimensions  || product?.dimensions;
                }

                if (LENS_CATEGORIES.includes(rawCategory)) {
                    if (item.orderType === "RX") {
                        item.index   = item.index   ?? product?.index;
                        item.coating = item.coating || product?.coating;
                    } else {
                        item.sph     = item.sph     ?? product?.sph;
                        item.cyl     = item.cyl     ?? product?.cyl;
                        item.axis    = item.axis    ?? product?.axis;
                        item.add     = item.add     ?? product?.add;
                        item.index   = item.index   ?? product?.index;
                        item.tint    = item.tint    || product?.tint;
                        item.coating = item.coating || product?.coating;
                    }
                }

                if (rawCategory === "CONTACT_LENS") {
                    item.color         = item.color         || product?.color;
                    item.expiry        = item.expiry        || product?.expiry;
                    item.disposability = item.disposability || product?.disposability;
                }

                if (item.orderType === "RX" && item.rx) {
                    const cleanId = (id) => (id && mongoose.Types.ObjectId.isValid(id) ? id : undefined);
                    if (item.rx.vendor) item.rx.vendor.id   = cleanId(item.rx.vendor.id);
                    if (item.rx.lab)    item.rx.lab.id      = cleanId(item.rx.lab.id);
                    if (item.rx.coating)   item.rx.coating.id   = cleanId(item.rx.coating.id);
                    if (item.rx.treatment) item.rx.treatment.id = cleanId(item.rx.treatment.id);
                    if (item.rx.tint)      item.rx.tint.id      = cleanId(item.rx.tint.id);
                    if (item.rx.brand)     item.rx.brand.id     = cleanId(item.rx.brand.id);
                    if (item.rx.category)  item.rx.category.id  = cleanId(item.rx.category.id);
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
            if (order.estimatedDeliveryDate) {
                order.estimatedDeliveryDate = new Date(order.estimatedDeliveryDate);
            }
        }

        const customerDoc = {
            customerId:               customer._id,
            customerName:             customer.ownerName || customer.shopName,
            customerShipToId:         resolvedShipToId,
            customerShipToBranchName: shipToBranchName,
        };

        const bulkOrder = await BulkOrder.create({
            customer:        customerDoc,
            orders,
            advanceAmount:   Number(advanceAmount   || 0),
            shippingCharges: Number(shippingCharges || 0),
            otherCharges:    Number(otherCharges    || 0),
            tenantId:        req.user.tenantId,
        });

        if (!isDraft) {
            await applyOrderToCustomerCreditAndLedger({
                bulkOrder,
                customerId: customer._id,
                userId:     req.user.id || req.user._id,
                tenantId:   req.user.tenantId,
                reqBody:    req.body,
            }).catch(err => console.error("Customer credit/ledger sync error on order create:", err.message));

            await createRxVendorPurchaseOrders({
                bulkOrder,
                tenantId:  req.user.tenantId,
                createdBy: req.user._id,
            }).catch(err => console.error("RX vendor PO creation error:", err.message));

            await createStockVendorPurchaseOrders({
                bulkOrder,
                tenantId:  req.user.tenantId,
                createdBy: req.user._id,
            }).catch(err => console.error("STOCK vendor PO creation error:", err.message));

            sendVendorRxOrderEmails({ bulkOrder, customer }).catch(err =>
                console.error("Vendor email notification error:", err.message)
            );

            const stockDeductions = [];
            for (const order of bulkOrder.orders) {
                for (const item of order.items) {
                    if (item.orderType === "STOCK" && item.productId && !item.vendor?.id) {
                        stockDeductions.push({
                            updateOne: {
                                filter: { _id: item.productId, tenantId: req.user.tenantId, qty: { $gte: item.qty } },
                                update: { $inc: { qty: -item.qty } },
                            },
                        });
                    }
                }
            }
            if (stockDeductions.length > 0) {
                await DigiProduct.bulkWrite(stockDeductions);
            }
        }

        if (!isDraft) {
            handleOrderBillingNotification({ bulkOrder, customer }).catch(err =>
                console.error("Billing notification error:", err.message)
            );

            sendLowStockAlerts({
                orders:       bulkOrder.orders,
                productMap,
                customerName: customer.ownerName || customer.shopName,
                orderNumber:  bulkOrder.orders[0]?.orderNumber || bulkOrder._id.toString(),
            }).catch(err => console.error("Low stock alert error:", err.message));

            generateAndStoreChallan(bulkOrder._id.toString(), req.user.tenantId).catch(err =>
                console.error("Pre-generate challan error:", err.message)
            );
            generateAndStoreInvoice(bulkOrder._id.toString(), req.user.tenantId).catch(err =>
                console.error("Pre-generate invoice error:", err.message)
            );
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

        const bulkOrder = await BulkOrder.findOne({ _id: orderId, tenantId: req.user.tenantId }).select("challanUrl orders customer").lean();
        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Bulk order not found");
        }

        const fileName = `challan-${bulkOrder.orders[0]?.orderNumber || orderId}.pdf`;

        if (bulkOrder.challanUrl) {
            try {
                const { default: axios } = await import("axios");
                const response = await axios.get(bulkOrder.challanUrl, { responseType: "arraybuffer", timeout: 4000 });
                const buffer   = Buffer.from(response.data);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
                res.setHeader("Content-Length", buffer.length);
                return res.end(buffer);
            } catch (fetchErr) {
                console.warn("[PDF] Failed to fetch stored challan from GCS, regenerating on the fly:", fetchErr.message);
            }
        }

        const { url, buffer } = await generateAndStoreChallan(orderId, req.user.tenantId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", buffer.length);
        return res.end(buffer);
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

        const bulkOrder = await BulkOrder.findOne({ _id: orderId, tenantId: req.user.tenantId }).select("invoiceUrl orders customer").lean();
        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Bulk order not found");
        }

        const fileName = `invoice-${bulkOrder.orders[0]?.orderNumber || orderId}.pdf`;

        if (bulkOrder.invoiceUrl) {
            try {
                const { default: axios } = await import("axios");
                const response = await axios.get(bulkOrder.invoiceUrl, { responseType: "arraybuffer", timeout: 4000 });
                const buffer   = Buffer.from(response.data);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
                res.setHeader("Content-Length", buffer.length);
                return res.end(buffer);
            } catch (fetchErr) {
                console.warn("[PDF] Failed to fetch stored invoice from GCS, regenerating on the fly:", fetchErr.message);
            }
        }

        const { url, buffer } = await generateAndStoreInvoice(orderId, req.user.tenantId);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", buffer.length);
        return res.end(buffer);
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

        if (!status || !VALID_STATUSES.includes(status)) {
            return sendErrorResponse(res, 400, "INVALID_STATUS", `Status must be one of: ${VALID_STATUSES.join(", ")}`);
        }

        const bulkOrder = await BulkOrder.findOne({ _id: orderId, tenantId: req.user.tenantId });
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

            order.statusHistory.push({
                from:          order.status,
                to:            status,
                remarks:       remarks || "",
                changedBy:     req.user._id,
                changedByName: req.user.employeeName || req.user.name || "",
                changedAt:     new Date(),
            });

            order.status  = status;
            order.remarks = remarks || order.remarks || null;
        }

        await bulkOrder.save();

        if (status === "Cancelled") {
            await revertOrderCreditOnCancellation({
                bulkOrder,
                customerId: bulkOrder.customer?.customerId,
                cancelledOrders: ordersToUpdate,
                userId: req.user._id,
                tenantId: req.user.tenantId,
            }).catch(err => console.error("Order cancellation credit revert error:", err.message));
        }


        if (status === "Delivered") {
            const deliveredRxItems = ordersToUpdate.flatMap(o => o.items).filter(item => item.orderType === "RX");

            if (deliveredRxItems.length > 0) {
                const directProductIds = deliveredRxItems
                    .filter(item => item.productId)
                    .map(item => item.productId);

                let allRxProductIds = [...directProductIds];

                if (directProductIds.length < deliveredRxItems.length) {
                    const linkedPOs = await VendorPurchase.find({
                        sourceCustomerOrderId: bulkOrder._id,
                        tenantId: req.user.tenantId,
                    }).lean();

                    const poProductIds = linkedPOs
                        .flatMap(po => po.orders.flatMap(o => o.items))
                        .filter(item => item.productId && item.qcStatus === "PASSED")
                        .map(item => item.productId);

                    allRxProductIds = [...new Set([
                        ...allRxProductIds.map(id => id.toString()),
                        ...poProductIds.map(id => id.toString()),
                    ])];
                }

                if (allRxProductIds.length > 0) {
                    await DigiProduct.updateMany(
                        { _id: { $in: allRxProductIds }, tenantId: req.user.tenantId },
                        { $set: { qty: 0 } }
                    );
                    console.log(`[Delivered] Set qty=0 for ${allRxProductIds.length} RX product(s)`);
                }
            }
        }

        invalidatePDFs(orderId, req.user.tenantId).catch(err => console.error("PDF invalidation error:", err.message));

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

        const bulkOrder = await BulkOrder.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Order not found");
        }

        const canUpdate = bulkOrder.orders.every(o => ["Draft", "Submitted"].includes(o.status));
        if (!canUpdate) {
            return sendErrorResponse(res, 400, "INVALID_STATUS", "Only Draft or Submitted orders can be updateddd");
        }

        if (customerShipToId) {
            const customer = await Customer.findOne({ _id: bulkOrder.customer.customerId, tenantId: req.user.tenantId }).lean();
            if (customer) {
                const shipTo = customer.customerShipToDetails?.find(
                    s => s._id.toString() === customerShipToId.toString()
                );
                if (!shipTo) {
                    return sendErrorResponse(res, 404, "NOT_FOUND", "Ship-to address not found for this customer");
                }
                bulkOrder.customer.customerShipToId         = shipTo._id;
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
                        price:    item.price    ?? product?.price   ?? 0,
                        mrp:      item.mrp      ?? product?.mrp     ?? 0,
                        gst:      item.gst      ?? product?.gst     ?? 0,
                        hsnSac:   item.hsnSac   || product?.hsnSac  || "",
                        qty:      Number(item.qty || 0),
                    };
                });

                return {
                    orderNumber: existing?.orderNumber || incomingOrder.orderNumber || generateOrderNumber(),
                    items,
                    cgst:        incomingOrder.cgst !== undefined ? String(incomingOrder.cgst) : (existing?.cgst || "0"),
                    sgst:        incomingOrder.sgst !== undefined ? String(incomingOrder.sgst) : (existing?.sgst || "0"),
                    status:      submitNow ? "Submitted" : "Draft",
                    remarks:     incomingOrder.remarks || existing?.remarks || "",
                };
            });
        } else if (submitNow) {
            for (const order of bulkOrder.orders) {
                order.status = "Submitted";
            }
        }

        await bulkOrder.save();

        invalidatePDFs(id, req.user.tenantId).catch(err => console.error("PDF invalidation error:", err.message));

        if (submitNow) {
            const customer = await Customer.findOne({ _id: bulkOrder.customer.customerId, tenantId: req.user.tenantId }).lean();
            if (customer) {
                applyOrderToCustomerCreditAndLedger({
                    bulkOrder,
                    customerId: customer._id,
                    userId: req.user.id || req.user._id,
                    tenantId: req.user.tenantId,
                    reqBody: req.body,
                }).catch(err => console.error("Customer credit/ledger sync error on draft submit:", err.message));

                createRxVendorPurchaseOrders({
                    bulkOrder,
                    tenantId: req.user.tenantId,
                    createdBy: req.user._id,
                }).catch(err => console.error("RX vendor PO creation error on draft submit:", err.message));

                createStockVendorPurchaseOrders({
                    bulkOrder,
                    tenantId: req.user.tenantId,
                    createdBy: req.user._id,
                }).catch(err => console.error("STOCK vendor PO creation error on draft submit:", err.message));

                sendVendorRxOrderEmails({ bulkOrder, customer }).catch(err =>
                    console.error("Vendor email notification error on draft submit:", err.message)
                );

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

export const getPublicOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.query;

        if (!orderId) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "orderId is required");
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid orderId");
        }

        const bulkOrder = await BulkOrder.findById(orderId).lean();

        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Order not found");
        }

        const publicData = {
            orderId:       bulkOrder._id,
            customerName:  bulkOrder.customer.customerName,
            createdAt:     bulkOrder.createdAt,
            orders: bulkOrder.orders.map(order => ({
                orderNumber:           order.orderNumber,
                status:                order.status,
                estimatedDeliveryDate: order.estimatedDeliveryDate || null,
                remarks:               order.remarks || null,
                trackingId:            order.trackingId   || null,
                trackingLink:          order.trackingLink || null,
                totalItems:            order.items.length,
                statusHistory: (order.statusHistory || []).map(h => ({
                    from:          h.from,
                    to:            h.to,
                    remarks:       h.remarks || null,
                    changedByName: h.changedByName || null,
                    changedAt:     h.changedAt,
                })),
                items: order.items.map(item => ({
                    itemName:   item.itemName,
                    category:   item.category,
                    qty:        item.qty,
                    unit:       item.unit,
                    orderType:  item.orderType,
                    itemStatus: item.itemStatus,
                })),
            })),
        };

        return sendSuccessResponse(res, 200, { order: publicData }, "Order status retrieved successfully");

    } catch (error) {
        console.error("Get Public Order Status Error:", error);
        return sendErrorResponse(res, 500, "PUBLIC_ORDER_ERROR", error.message || "Something went wrong");
    }
};

export const updateOrderTracking = async (req, res) => {
    try {
        const { orderId }                   = req.params;
        const { trackingId, trackingLink }  = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return sendErrorResponse(res, 400, "INVALID_ORDER_ID", "Invalid orderId");
        }

        if (!trackingId && !trackingLink) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "At least one of trackingId or trackingLink is required");
        }

        const bulkOrder = await BulkOrder.findOne({ _id: orderId, tenantId: req.user.tenantId });
        if (!bulkOrder) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Bulk order not found");
        }

        for (const order of bulkOrder.orders) {
            if (trackingId   !== undefined) order.trackingId   = trackingId   || null;
            if (trackingLink !== undefined) order.trackingLink = trackingLink || null;
        }

        await bulkOrder.save();

        return sendSuccessResponse(res, 200, { bulkOrder }, "Tracking details updated successfully");
    } catch (error) {
        console.error("Update Order Tracking Error:", error);
        return sendErrorResponse(res, 500, "UPDATE_TRACKING_ERROR", error.message || "Something went wrong");
    }
};
