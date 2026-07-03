import mongoose from "mongoose";

const qcItemSchema = new mongoose.Schema(
    {
        orderNumber:    { type: String, required: true },
        itemIndex:      { type: Number, required: true },
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
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseQC", purchaseQCSchema);
