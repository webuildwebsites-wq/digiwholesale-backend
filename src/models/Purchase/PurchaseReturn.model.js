import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
    {
        orderNumber:           String,
        itemIndex:             Number,
        itemName:              String,
        productId:             { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct", default: null },
        category:              String,
        unit:                  String,
        qty:                   Number,
        reason:                String,
        condition:             { type: String, enum: ["DAMAGED", "WRONG_ITEM", "QUALITY_ISSUE", "OTHER"], default: "QUALITY_ISSUE" },
        damagedInventoryAdded: { type: Boolean, default: false },
    },
    { _id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
    {
        purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorPurchase", required: true },
        purchaseQCId:    { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseQC", default: null },
        vendorId:        { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        vendorName:      String,
        items:           [returnItemSchema],
        status:          { type: String, enum: ["Pending", "VendorNotified", "Replaced", "Closed"], default: "Pending" },
        vendorNotified:  { type: Boolean, default: false },
        vendorNotifiedAt:{ type: Date, default: null },
        remarks:         String,
        createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseReturn", purchaseReturnSchema);
