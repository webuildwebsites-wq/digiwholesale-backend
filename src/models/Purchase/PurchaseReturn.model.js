import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
    {
        itemId:                { type: mongoose.Schema.Types.ObjectId, required: true },
        orderNumber:           String,
        itemName:              String,
        productId:             { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct", default: null },
        category:              String,
        unit:                  String,
        qty:                   Number,
        reason:                String,
        condition:             { type: String, enum: ["DAMAGED", "SHRINKAGE"], default: "SHRINKAGE" },
        damagedInventoryAdded: { type: Boolean, default: false },
        itemStatus:            { type: String, enum: ["Pending", "VendorNotified", "Replaced", "Closed"], default: "Pending" },
        itemRemarks:           { type: String, default: null },
        itemUpdatedAt:         { type: Date,   default: null },
        itemUpdatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: "employee", default: null },
    },
    { _id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
    {
        purchaseOrderId:  { type: mongoose.Schema.Types.ObjectId, ref: "VendorPurchase", required: true },
        purchaseQCId:     { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseQC", default: null },
        vendorId:         { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        vendorName:       String,
        items:            [returnItemSchema],
        status:           { type: String, enum: ["Pending", "VendorNotified", "PartiallyReplaced", "Replaced", "Closed"], default: "Pending" },
        vendorNotified:   { type: Boolean, default: false },
        vendorNotifiedAt: { type: Date, default: null },
        remarks:          String,
        createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
        tenantId:         { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseReturn", purchaseReturnSchema);
