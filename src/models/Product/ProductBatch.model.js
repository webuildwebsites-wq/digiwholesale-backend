import mongoose from "mongoose";

const productBatchSchema = new mongoose.Schema(
    {
        batchNumber: {
            type:      String,
            required:  true,
            trim:      true,
            uppercase: true,
        },
        productId: {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      "DigiProduct",
            required: true,
            index:    true,
        },
        purchaseOrderId: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     "VendorPurchase",
            default: null,
        },
        purchaseQCId: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     "PurchaseQC",
            default: null,
        },
        initialQty: {
            type:     Number,
            required: true,
            min:      0,
        },
        availableQty: {
            type:     Number,
            required: true,
            min:      0,
        },
        costPrice: {
            type:    Number,
            default: 0,
            min:     0,
        },
        buyingPrice: {
            type:    Number,
            default: 0,
            min:     0,
        },
        sellingPrice: {
            type:    Number,
            default: 0,
            min:     0,
        },
        mrp: {
            type:    Number,
            default: 0,
            min:     0,
        },
        vendorId: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     "Vendor",
            default: null,
        },
        vendorName:  { type: String, default: null },
        expiry:      { type: Date, default: null },
        inwardDate:  { type: Date, default: Date.now },
        status:      { type: String, enum: ["OPEN", "EXHAUSTED"], default: "OPEN" },
        remarks:     { type: String, default: null },
        purchaseInwardId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseInward", default: null },
        invoices: [
            {
                url:          { type: String, required: true },
                originalName: { type: String, default: "" },
                mimetype:     { type: String, default: "" },
                size:         { type: Number, default: 0 },
                uploadedAt:   { type: Date,   default: Date.now },
            }
        ],
        createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
        tenantId:    { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

productBatchSchema.index({ productId: 1, tenantId: 1, status: 1, createdAt: 1 });
productBatchSchema.index({ productId: 1, tenantId: 1, batchNumber: 1 }, { unique: true });

const ProductBatch = mongoose.model("ProductBatch", productBatchSchema);
export default ProductBatch;
