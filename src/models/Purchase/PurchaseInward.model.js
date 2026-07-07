import mongoose from "mongoose";

const inwardItemSchema = new mongoose.Schema(
    {
        itemId:       { type: mongoose.Schema.Types.ObjectId, required: true },
        orderNumber:  { type: String, required: true },
        itemName:     String,
        productId:    { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct", default: null },
        category:     String,
        unit:         String,
        orderedQty:   Number,
        receivedQty:  { type: Number, required: true, min: 0 },
        vendorRefId:  String,
        condition:    { type: String, enum: ["GOOD", "DAMAGED", "PARTIAL"], default: "GOOD" },
        remarks:      String,
    },
    { _id: false }
);

const purchaseInwardSchema = new mongoose.Schema(
    {
        purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorPurchase", required: true },
        vendorId:        { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        vendorName:      String,
        inwardDate:      { type: Date, default: Date.now },
        items:           [inwardItemSchema],
        remarks:         String,
        status:          { type: String, enum: ["Draft", "Confirmed"], default: "Confirmed" },
        createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseInward", purchaseInwardSchema);
