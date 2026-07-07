import mongoose from "mongoose";
import PurchaseQC from "../../../models/Purchase/PurchaseQC.model.js";
import PurchaseInward from "../../../models/Purchase/PurchaseInward.model.js";
import PurchaseReturn from "../../../models/Purchase/PurchaseReturn.model.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import DigiProduct from "../../../models/Product/Product.model.js";
import Vendor from "../../../models/Vendor.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";
import { sendEmail } from "../../config/Email/emailService.js";
import { sendWhatsAppOTP } from "../../config/Whatsapp/sendWhatsappOtp.js";

const buildQCFailureEmailHTML = ({ vendorName, purchaseOrderId, failedItems }) => {
    const rows = failedItems.map(item => `
        <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${item.itemName || "-"}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${item.failedQty}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${item.failureReason || "-"}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${item.remarks || "-"}</td>
        </tr>`).join("");

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:0;">
  <div style="max-width:640px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:#dc2626;padding:20px 28px;color:#fff;">
      <div style="font-size:20px;font-weight:700;">DigiOptics — QC Rejection Notice</div>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:15px;margin-bottom:16px;">Dear <b>${vendorName}</b>,</p>
      <p style="font-size:14px;color:#555;margin-bottom:20px;">
        The following items from Purchase Order <b>${purchaseOrderId}</b> have <b style="color:#dc2626;">failed QC inspection</b> and will be returned to you.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Item</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">Failed Qty</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Reason</th>
            <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Remarks</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;font-size:13px;color:#555;">Please arrange for replacement or credit note at the earliest.</p>
    </div>
    <div style="background:#f5f5f5;text-align:center;padding:14px;font-size:12px;color:#777;">
      © ${new Date().getFullYear()} DigiOptics. System generated notice.
    </div>
  </div>
</body>
</html>`;
};

export const createPurchaseQC = async (req, res) => {
    try {
        const { purchaseOrderId, purchaseInwardId, items, notifyVendor = true, remarks } = req.body;

        if (!purchaseOrderId || !mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid purchaseOrderId is required");
        }
        if (!purchaseInwardId || !mongoose.Types.ObjectId.isValid(purchaseInwardId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid purchaseInwardId is required");
        }
        if (!Array.isArray(items) || items.length === 0) {
            return sendErrorResponse(res, 400, "VALIDATION_ERROR", "items array is required");
        }

        const [purchaseOrder, inward] = await Promise.all([
            VendorPurchase.findById(purchaseOrderId),
            PurchaseInward.findById(purchaseInwardId),
        ]);

        if (!purchaseOrder) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase order not found");
        if (!inward)        return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase inward not found");

        const vendor = await Vendor.findById(purchaseOrder.vendor.vendorId).lean();

        const allPurchaseItems = purchaseOrder.orders.flatMap(o =>
            o.items.map(item => ({ order: o, item }))
        );

        for (const entry of items) {
            const { itemId, passedQty, failedQty } = entry;

            if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `Invalid or missing itemId: ${itemId}`, new Date().toISOString(), { itemId });
            }

            const found = allPurchaseItems.find(({ item }) => item._id.toString() === itemId.toString());
            if (!found) {
                return sendErrorResponse(res, 404, "ITEM_NOT_FOUND", `Item not found in this purchase order: ${itemId}`, new Date().toISOString(), { itemId });
            }

            const passed      = Number(passedQty || 0);
            const failed      = Number(failedQty || 0);
            const receivedQty = found.item.receivedQty || 0;

            if (passed < 0 || failed < 0) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `passedQty and failedQty cannot be negative for item: ${found.item.itemName}`, new Date().toISOString(), { itemId });
            }

            if (passed + failed > receivedQty) {
                return sendErrorResponse(res, 400, "VALIDATION_ERROR", `passedQty (${passed}) + failedQty (${failed}) = ${passed + failed} exceeds receivedQty (${receivedQty}) for item: ${found.item.itemName}`, new Date().toISOString(), { itemId });
            }
        }

        const qcItems     = [];
        const failedItems = [];
        const passedItems = [];

        for (const entry of items) {
            const { itemId, passedQty, failedQty, failureReason, remarks: itemRemark } = entry;

            const found      = allPurchaseItems.find(({ item }) => item._id.toString() === itemId.toString());
            const { order, item } = found;
            const passed     = Number(passedQty || 0);
            const failed     = Number(failedQty || 0);
            const total      = passed + failed;

            const qcResult = failed === 0 ? "PASSED" : passed === 0 ? "FAILED" : "PARTIAL";

            item.qcStatus = qcResult;

            qcItems.push({
                itemId:        item._id,
                orderNumber:   order.orderNumber,
                itemName:      item.itemName,
                productId:     item.productId,
                category:      item.category,
                unit:          item.unit,
                receivedQty:   item.receivedQty || total,
                passedQty:     passed,
                failedQty:     failed,
                qcResult,
                failureReason: failureReason || "",
                remarks:       itemRemark     || "",
            });

            if (passed > 0 && item.productId) {
                passedItems.push({ productId: item.productId, qty: passed });
            }

            if (failed > 0) {
                failedItems.push({
                    itemId:        item._id,
                    orderNumber:   order.orderNumber,
                    itemName:      item.itemName,
                    productId:     item.productId,
                    category:      item.category,
                    unit:          item.unit,
                    qty:           failed,
                    reason:        failureReason || "",
                    failedQty:     failed,
                    failureReason: failureReason || "",
                    remarks:       itemRemark    || "",
                    condition:     "QUALITY_ISSUE",
                });
            }
        }

        const allPassed     = qcItems.every(i => i.qcResult === "PASSED");
        const allFailed     = qcItems.every(i => i.qcResult === "FAILED");
        const overallResult = allPassed ? "PASSED" : allFailed ? "FAILED" : "PARTIAL";

        await purchaseOrder.save();

        const purchaseQC = await PurchaseQC.create({
            purchaseOrderId,
            purchaseInwardId,
            vendorId:   purchaseOrder.vendor.vendorId,
            vendorName: purchaseOrder.vendor.vendorName,
            qcDate:     new Date(),
            items:      qcItems,
            overallResult,
            notifyVendor,
            remarks,
            createdBy: req.user._id,
        });

        if (passedItems.length > 0) {
            const bulkOps = passedItems.map(({ productId, qty }) => ({
                updateOne: {
                    filter: { _id: productId },
                    update: { $inc: { qty } },
                },
            }));
            await DigiProduct.bulkWrite(bulkOps);
        }

        let purchaseReturn = null;
        if (failedItems.length > 0) {
            purchaseReturn = await PurchaseReturn.create({
                purchaseOrderId,
                purchaseQCId:  purchaseQC._id,
                vendorId:      purchaseOrder.vendor.vendorId,
                vendorName:    purchaseOrder.vendor.vendorName,
                items:         failedItems,
                status:        "Pending",
                vendorNotified: false,
                createdBy:     req.user._id,
            });

            if (notifyVendor && vendor) {
                const html = buildQCFailureEmailHTML({
                    vendorName:      purchaseOrder.vendor.vendorName,
                    purchaseOrderId: purchaseOrderId.toString(),
                    failedItems,
                });

                if (vendor.email) {
                    sendEmail({
                        to:      vendor.email,
                        subject: `QC Rejection Notice — Purchase Order ${purchaseOrderId}`,
                        html,
                    }).catch(err => console.error("QC rejection email error:", err.message));
                }

                if (vendor.mobile) {
                    sendWhatsAppOTP({
                        phone: `91${vendor.mobile}`,
                        otp:   `QC FAILED for PO ${purchaseOrderId}. ${failedItems.length} item(s) rejected. Please arrange replacement.`,
                    }).catch(err => console.error("QC WhatsApp error:", err.message));
                }

                await PurchaseReturn.findByIdAndUpdate(purchaseReturn._id, {
                    vendorNotified:   true,
                    vendorNotifiedAt: new Date(),
                    status:           "VendorNotified",
                });
            }
        }

        return sendSuccessResponse(res, 201, {
            purchaseQC,
            purchaseReturn,
            inventoryUpdated: passedItems.length,
            failedItems:      failedItems.length,
        }, `QC completed — ${overallResult}. ${passedItems.length} item(s) added to inventory, ${failedItems.length} item(s) failed.`);

    } catch (error) {
        console.error("Create Purchase QC Error:", error);
        return sendErrorResponse(res, 500, "CREATE_QC_ERROR", error.message);
    }
};

export const getAllPurchaseQCs = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const filter = {};
        if (req.query.purchaseOrderId && mongoose.Types.ObjectId.isValid(req.query.purchaseOrderId)) {
            filter.purchaseOrderId = new mongoose.Types.ObjectId(req.query.purchaseOrderId);
        }
        if (req.query.vendorId && mongoose.Types.ObjectId.isValid(req.query.vendorId)) {
            filter.vendorId = new mongoose.Types.ObjectId(req.query.vendorId);
        }
        if (req.query.overallResult) filter.overallResult = req.query.overallResult;

        const [qcs, total] = await Promise.all([
            PurchaseQC.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PurchaseQC.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            qcs,
            pagination: {
                currentPage:  page,
                totalPages:   Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        }, "Purchase QC records retrieved successfully");

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_QCS_ERROR", error.message);
    }
};

export const getPurchaseQCById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Invalid ID");
        }
        const qc = await PurchaseQC.findById(id).lean();
        if (!qc) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase QC not found");
        return sendSuccessResponse(res, 200, { qc });
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_QC_ERROR", error.message);
    }
};
