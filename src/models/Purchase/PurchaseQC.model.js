import mongoose from "mongoose";

const qcItemSchema = new mongoose.Schema(
    {
        itemId:         { type: mongoose.Schema.Types.ObjectId, required: true },
        orderNumber:    { type: String, required: true },
        itemName:       String,
        productId:      { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct", default: null },
        category:       String,
        unit:           String,
        receivedQty:    Number,
        passedQty:      { type: Number, default: 0 },
        failedQty:      { type: Number, default: 0 },
        qcResult:       { type: String, enum: ["PASSED", "FAILED", "PARTIAL"], required: true },
        failureReason:  String,
        remarks:        String,
        photos:         { type: [String], default: [] },
    },
    { _id: false }
);

const purchaseQCSchema = new mongoose.Schema(
    {
        purchaseOrderId:  { type: mongoose.Schema.Types.ObjectId, ref: "VendorPurchase", required: true },
        purchaseInwardId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseInward", required: true },
        vendorId:         { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        vendorName:       String,
        qcDate:           { type: Date, default: Date.now },
        items:            [qcItemSchema],
        overallResult:    { type: String, enum: ["PASSED", "FAILED", "PARTIAL"], required: true },
        notifyVendor:     { type: Boolean, default: true },
        remarks:          String,
        createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
        createdByName:    { type: String, default: null },
        tenantId:         { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseQC", purchaseQCSchema);
