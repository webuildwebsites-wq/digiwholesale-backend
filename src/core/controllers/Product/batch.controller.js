import mongoose from "mongoose";
import ProductBatch from "../../../models/Product/ProductBatch.model.js";
import DigiProduct  from "../../../models/Product/Product.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";


export const getNextBatchNumber = async (productId, tenantId) => {
    const lastBatch = await ProductBatch.findOne({ productId, tenantId })
        .sort({ createdAt: -1 })
        .select("batchNumber")
        .lean();

    if (!lastBatch) return "BTCN1";

    const match = lastBatch.batchNumber.match(/BTCN(\d+)$/i);
    const num = match ? parseInt(match[1], 10) : 0;
    return `BTCN${num + 1}`;
};


export const getBatchesForProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid productId is required");
        }

        const product = await DigiProduct.findOne({ _id: productId, tenantId: req.user.tenantId }).select("qty productName productCode price").lean();

        const statusFilter = req.query.status || "OPEN"; // default: only open
        const query = { productId, tenantId: req.user.tenantId };
        if (statusFilter !== "ALL") query.status = statusFilter;

        const batches = await ProductBatch.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // Calculate summary stats
        const openBatches = await ProductBatch.find({ productId, tenantId: req.user.tenantId, status: "OPEN" }).lean();
        const totalStock = product ? Number(product.qty || 0) : 0;
        const allocatedQty = openBatches.reduce((sum, b) => sum + Number(b.availableQty || 0), 0);
        const unallocatedQty = Math.max(totalStock - allocatedQty, 0);

        return sendSuccessResponse(res, 200, {
            batches,
            totalStock,
            allocatedQty,
            unallocatedQty,
            productPrice: product?.price || 0
        }, "Batches fetched successfully");
    } catch (error) {
        console.error("getBatchesForProduct error:", error);
        return sendErrorResponse(res, 500, "FETCH_ERROR", error.message);
    }
};


export const allocateManualBatch = async (req, res) => {
    try {
        const { productId, batchNumber: customBatchNumber, qty, costPrice, remarks, vendorId, vendorName } = req.body;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid productId is required");
        }

        const product = await DigiProduct.findOne({ _id: productId, tenantId: req.user.tenantId });
        if (!product) {
            return sendErrorResponse(res, 404, "NOT_FOUND", "Product not found");
        }

        const totalStock = Number(product.qty || 0);

        const openBatches = await ProductBatch.find({ productId, tenantId: req.user.tenantId, status: "OPEN" });
        const allocatedQty = openBatches.reduce((sum, b) => sum + Number(b.availableQty || 0), 0);
        const unallocatedQty = Math.max(totalStock - allocatedQty, 0);

        if (unallocatedQty <= 0) {
            return sendErrorResponse(
                res,
                400,
                "NO_UNALLOCATED_STOCK",
                `Cannot allocate batch. All stock of this product (${totalStock} units) is already allocated to existing batches.`
            );
        }

        const requestedQty = Number(qty);
        if (!requestedQty || requestedQty <= 0) {
            return sendErrorResponse(res, 400, "INVALID_QTY", "Allocated quantity must be greater than 0");
        }

        if (requestedQty > unallocatedQty) {
            return sendErrorResponse(
                res,
                400,
                "EXCEEDS_UNALLOCATED_STOCK",
                `Cannot allocate ${requestedQty} units. Only ${unallocatedQty} unit(s) remaining unallocated out of total ${totalStock} stock.`
            );
        }

        let finalBatchNumber = customBatchNumber ? customBatchNumber.trim().toUpperCase() : "";
        if (!finalBatchNumber) {
            finalBatchNumber = await getNextBatchNumber(productId, req.user.tenantId);
        } else {
            const existing = await ProductBatch.findOne({
                productId,
                tenantId: req.user.tenantId,
                batchNumber: finalBatchNumber
            });
            if (existing) {
                return sendErrorResponse(res, 400, "BATCH_EXISTS", `Batch number '${finalBatchNumber}' already exists for this product`);
            }
        }

        const batch = await ProductBatch.create({
            batchNumber: finalBatchNumber,
            productId: product._id,
            initialQty: requestedQty,
            availableQty: requestedQty,
            costPrice: costPrice !== undefined && costPrice !== "" ? Number(costPrice) : (Number(product.price) || 0),
            vendorId: vendorId && mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : null,
            vendorName: vendorName || null,
            remarks: remarks || "Manual batch allocation from Inventory",
            status: "OPEN",
            tenantId: req.user.tenantId,
            createdBy: req.user._id,
        });

        const newAllocated = allocatedQty + requestedQty;
        const newUnallocated = Math.max(totalStock - newAllocated, 0);

        return sendSuccessResponse(res, 201, {
            batch,
            totalStock,
            allocatedQty: newAllocated,
            unallocatedQty: newUnallocated
        }, `Batch ${finalBatchNumber} allocated successfully (${requestedQty} units)`);
    } catch (error) {
        console.error("allocateManualBatch error:", error);
        return sendErrorResponse(res, 500, "ALLOCATION_ERROR", error.message);
    }
};

export const getAllBatches = async (req, res) => {
    try {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const skip  = (page - 1) * limit;

        const filter = { tenantId: req.user.tenantId };

        if (req.query.productId && mongoose.Types.ObjectId.isValid(req.query.productId)) {
            filter.productId = new mongoose.Types.ObjectId(req.query.productId);
        }
        if (req.query.status && req.query.status !== "ALL") {
            filter.status = req.query.status;
        }
        if (req.query.search) {
            filter.batchNumber = { $regex: req.query.search, $options: "i" };
        }

        const [batches, total] = await Promise.all([
            ProductBatch.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("productId", "productName productCode category")
                .lean(),
            ProductBatch.countDocuments(filter),
        ]);

        return sendSuccessResponse(res, 200, {
            batches,
            pagination: {
                currentPage: page,
                totalPages:  Math.ceil(total / limit),
                totalItems:  total,
            },
        }, "Batches fetched successfully");
    } catch (error) {
        console.error("getAllBatches error:", error);
        return sendErrorResponse(res, 500, "FETCH_ERROR", error.message);
    }
};


export const getBatchById = async (req, res) => {
    try {
        const { batchId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(batchId)) {
            return sendErrorResponse(res, 400, "INVALID_ID", "Valid batchId is required");
        }

        const batch = await ProductBatch.findOne({ _id: batchId, tenantId: req.user.tenantId })
            .populate("productId", "productName productCode category brand")
            .lean();

        if (!batch) return sendErrorResponse(res, 404, "NOT_FOUND", "Batch not found");

        return sendSuccessResponse(res, 200, { batch }, "Batch fetched successfully");
    } catch (error) {
        console.error("getBatchById error:", error);
        return sendErrorResponse(res, 500, "FETCH_ERROR", error.message);
    }
};
