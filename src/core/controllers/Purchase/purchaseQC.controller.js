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
import { generateQCRejectionExcel } from "../../../Utils/excel/generateQCRejectionExcel.js";

const buildQCRejectionEmailHTML = ({ vendorName, purchaseOrderId, qcDate, failedItems, totalFailed, totalPassed }) => {
    const fmt    = (v) => (v !== undefined && v !== null && v !== "" ? v : "-");
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "-";

    const rows = failedItems.map((item, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#fff" : "#fef2f2"};">
            <td style="padding:9px 12px;border:1px solid #fecaca;vertical-align:top;">
                <div style="font-weight:bold;font-size:13px;">${fmt(item.itemName)}</div>
                ${item.category ? `<div style="font-size:11px;color:#666;">${item.category}</div>` : ""}
                ${item.orderNumber ? `<div style="font-size:11px;color:#999;">${item.orderNumber}</div>` : ""}
            </td>
            <td style="padding:9px 12px;border:1px solid #fecaca;text-align:center;font-weight:bold;color:#dc2626;">${item.failedQty || item.qty || 0}</td>
            <td style="padding:9px 12px;border:1px solid #fecaca;">${fmt(item.unit)}</td>
            <td style="padding:9px 12px;border:1px solid #fecaca;">${fmt(item.failureReason || item.reason)}</td>
            <td style="padding:9px 12px;border:1px solid #fecaca;">${fmt(item.remarks)}</td>
        </tr>`).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:720px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#dc2626;padding:22px 28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;">DigiOptics</div>
      <div style="font-size:13px;margin-top:4px;opacity:0.9;">Quality Control — Rejection Notice</div>
    </div>

    <div style="padding:18px 28px;background:#fef2f2;border-bottom:2px solid #dc2626;">
      <p style="margin:0 0 6px;font-size:15px;">Dear <b>${fmt(vendorName)}</b>,</p>
      <p style="margin:0;font-size:14px;color:#555;">
        The following items from your purchase order have <b style="color:#dc2626;">failed our QC inspection</b> and will be returned. Please arrange for a replacement or credit note at the earliest.
      </p>
    </div>

    <div style="padding:20px 28px;">

      <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;margin-bottom:24px;">
        <tr>
          <td style="padding:9px 14px;font-weight:bold;color:#dc2626;font-size:12px;text-transform:uppercase;width:35%;">Purchase Order ID</td>
          <td style="padding:9px 14px;font-size:13px;font-weight:bold;">${fmt(purchaseOrderId)}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:9px 14px;font-weight:bold;color:#dc2626;font-size:12px;text-transform:uppercase;">QC Date</td>
          <td style="padding:9px 14px;font-size:13px;">${fmtDate(qcDate)}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;font-weight:bold;color:#dc2626;font-size:12px;text-transform:uppercase;">Items Passed</td>
          <td style="padding:9px 14px;font-size:13px;color:#16a34a;font-weight:bold;">${totalPassed}</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:9px 14px;font-weight:bold;color:#dc2626;font-size:12px;text-transform:uppercase;">Items Failed</td>
          <td style="padding:9px 14px;font-size:13px;color:#dc2626;font-weight:bold;">${totalFailed}</td>
        </tr>
      </table>

      <div style="font-size:15px;font-weight:700;color:#dc2626;margin-bottom:12px;border-left:4px solid #dc2626;padding-left:10px;">
        Rejected Items (${failedItems.length})
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <thead>
          <tr style="background:#fee2e2;">
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Item</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:center;">Failed Qty</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Unit</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Reason</th>
            <th style="padding:8px 12px;border:1px solid #fecaca;text-align:left;">Remarks</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px 16px;font-size:13px;color:#7f1d1d;">
        <b>Next Steps:</b> Please review the attached Excel file for complete rejection details. Arrange for replacement delivery or issue a credit note within 7 working days.
      </div>

    </div>

    <div style="background:#f5f5f5;text-align:center;padding:14px 28px;font-size:12px;color:#777;border-top:1px solid #e0e0e0;">
      © ${new Date().getFullYear()} DigiOptics. This is a system-generated QC rejection notice. Please do not reply to this email.
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

            if (found.item.qcStatus !== "PENDING") {
                return sendErrorResponse(res, 400, "ALREADY_QC_DONE", `QC already completed (status: ${found.item.qcStatus}) for item: ${found.item.itemName}`, new Date().toISOString(), { itemId });
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
            const { itemId, passedQty, failedQty, failureReason, remarks: itemRemark, photos } = entry;

            const found           = allPurchaseItems.find(({ item }) => item._id.toString() === itemId.toString());
            const { order, item } = found;
            const passed          = Number(passedQty || 0);
            const failed          = Number(failedQty || 0);
            const total           = passed + failed;
            const qcResult        = failed === 0 ? "PASSED" : passed === 0 ? "FAILED" : "PARTIAL";
            const itemPhotos      = (qcResult === "FAILED" || qcResult === "PARTIAL") && Array.isArray(photos)
                ? photos
                : [];

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
                photos:        itemPhotos,
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
                    photos:        itemPhotos,
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
            vendorId:      purchaseOrder.vendor.vendorId,
            vendorName:    purchaseOrder.vendor.vendorName,
            qcDate:        new Date(),
            items:         qcItems,
            overallResult,
            notifyVendor,
            remarks,
            createdBy:     req.user._id,
            createdByName: req.user.employeeName || req.user.name || null,
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
                const html = buildQCRejectionEmailHTML({
                    vendorName:      purchaseOrder.vendor.vendorName,
                    purchaseOrderId: purchaseOrderId.toString(),
                    qcDate:          new Date(),
                    failedItems,
                    totalPassed:     passedItems.reduce((s, i) => s + i.qty, 0),
                    totalFailed:     failedItems.reduce((s, i) => s + (i.failedQty || i.qty || 0), 0),
                });

                const excelBuffer = generateQCRejectionExcel({
                    purchaseOrderId: purchaseOrderId.toString(),
                    purchaseQCId:    purchaseQC._id.toString(),
                    vendorName:      purchaseOrder.vendor.vendorName,
                    qcDate:          new Date(),
                    failedItems,
                });

                if (vendor.email) {
                    sendEmail({
                        to:      vendor.email,
                        subject: `QC Rejection Notice — Purchase Order ${purchaseOrderId}`,
                        html,
                        attachments: [
                            {
                                name:    `QC-Rejection-${purchaseOrderId}.xlsx`,
                                content: excelBuffer.toString("base64"),
                            },
                        ],
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
            PurchaseQC.find(filter)
                .populate("createdBy", "employeeName username")
                .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
        const qc = await PurchaseQC.findById(id)
            .populate("createdBy", "employeeName username email")
            .lean();
        if (!qc) return sendErrorResponse(res, 404, "NOT_FOUND", "Purchase QC not found");
        return sendSuccessResponse(res, 200, { qc });
    } catch (error) {
        return sendErrorResponse(res, 500, "GET_QC_ERROR", error.message);
    }
};

export const getQCFailedItemsReport = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip  = (page - 1) * limit;

        const { vendorId, purchaseOrderId, fromDate, toDate } = req.query;

        const matchStage = {
            "items.qcResult": { $in: ["FAILED", "PARTIAL"] },
        };

        if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
            matchStage.vendorId = new mongoose.Types.ObjectId(vendorId);
        }
        if (purchaseOrderId && mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
            matchStage.purchaseOrderId = new mongoose.Types.ObjectId(purchaseOrderId);
        }
        if (fromDate || toDate) {
            matchStage.createdAt = {};
            if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                matchStage.createdAt.$lte = end;
            }
        }

        const [result, totalDocs] = await Promise.all([
            PurchaseQC.aggregate([
                { $match: matchStage },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $project: {
                        _id:             1,
                        purchaseOrderId: 1,
                        vendorId:        1,
                        vendorName:      1,
                        qcDate:          1,
                        overallResult:   1,
                        createdAt:       1,
                        failedItems: {
                            $filter: {
                                input: "$items",
                                as:    "item",
                                cond:  { $in: ["$$item.qcResult", ["FAILED", "PARTIAL"]] },
                            },
                        },
                        totalFailedQty: {
                            $sum: {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: "$items",
                                            as:    "item",
                                            cond:  { $in: ["$$item.qcResult", ["FAILED", "PARTIAL"]] },
                                        },
                                    },
                                    as: "fi",
                                    in: "$$fi.failedQty",
                                },
                            },
                        },
                    },
                },
            ]),
            PurchaseQC.countDocuments(matchStage),
        ]);

        const totalPages = Math.ceil(totalDocs / limit);

        return sendSuccessResponse(res, 200, {
            report: result,
            pagination: {
                currentPage:  page,
                totalPages,
                totalRecords: totalDocs,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        }, "QC failed items report retrieved successfully");

    } catch (error) {
        return sendErrorResponse(res, 500, "GET_QC_REPORT_ERROR", error.message);
    }
};
