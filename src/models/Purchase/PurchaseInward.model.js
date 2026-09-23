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

        receivedBy:   { type: String, trim: true, default: null }, 
        receivedOn:   { type: Date,   default: null },             
        receivedFrom: { type: String, trim: true, default: null },  
        items:    [inwardItemSchema],
        remarks:  String,
        status:   { type: String, enum: ["Draft", "Confirmed"], default: "Confirmed" },
        invoices: [
            {
                url:          { type: String, required: true },
                originalName: { type: String, default: "" },
                mimetype:     { type: String, default: "" },
                size:         { type: Number, default: 0 },
                uploadedAt:   { type: Date,   default: Date.now },
            }
        ],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
        tenantId:  { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseInward", purchaseInwardSchema);
