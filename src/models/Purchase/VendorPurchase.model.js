import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DigiProduct",
            required: false,
            default: null,
        },
        isNewProduct:   { type: Boolean, default: false },
        orderType:      { type: String, enum: ["STOCK", "RX"] },
        code:           String,
        itemName:       String,
        category:       String,
        unit:           { type: String, enum: ["PIECE", "PAIR", "BOX"] },
        brand:          String,
        color:          String,
        size:           String,
        shape:          String,
        material:       String,
        dimensions:     String,
        price:          Number,
        gst:            Number,
        hsnSac:         String,
        mrp:            Number,
        qty:            Number,
        sph:            Number,
        cyl:            Number,
        axis:           Number,
        add:            Number,
        index:          Number,
        tint:           String,
        coating:        String,
        discountPercent:Number,
        discountAmount: Number,
        expiry:         String,
        disposability:  String,

        vendorRefId:          { type: String, default: null },
        vendorRefIdUpdatedAt: { type: Date,   default: null },
        vendorRefIdUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "employee", default: null },

        isPriceConfirmed:  { type: Boolean, default: false },
        priceConfirmedAt:  { type: Date,    default: null },
        priceConfirmedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "employee", default: null },

        inwardStatus: {
            type:    String,
            enum:    ["PENDING", "RECEIVED", "PARTIAL", "NOT_RECEIVED"],
            default: "PENDING",
        },
        receivedQty: { type: Number, default: 0 },

        qcStatus: {
            type:    String,
            enum:    ["PENDING", "PASSED", "FAILED", "PARTIAL"],
            default: "PENDING",
        },
        rx: {
            vendor:     { id: String, name: String },
            lab:        { id: String, name: String },
            brand:      { id: String, name: String },
            category:   { id: String, name: String },
            productName:{ id: String, name: String },
            coating:    { id: String, name: String },
            treatment:  { id: String, name: String },
            tint:       { id: String, name: String },
            tintValue:  Number,
            index:      Number,
            powers:     { type: Array, default: [] },
            prisms:     { type: Array, default: [] },
            centration: { type: Array, default: [] },
            resolved:   { type: Array, default: [] },
            fitting:    { type: Object, default: {} },
            lensData:   { type: Object, default: {} },
            remarks:    String,
        },
    }
);

const vendorPurchaseOrderSchema = new mongoose.Schema(
    {
        orderNumber:      String,
        items:            [purchaseItemSchema],
        cgst:             String,
        sgst:             String,
        status: {
            type:    String,
            enum:    ["Submitted", "PartiallyReceived", "Received", "Closed"],
            default: "Submitted",
        },
        totalOrderPrice:  Number,
        remarks:          String,
    },
    { _id: false }
);

const vendorPurchaseSchema = new mongoose.Schema(
    {
        vendor: {
            vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
            vendorName: { type: String, required: true },
            email:      { type: String },
            mobile:     { type: String },
            address:    { type: String },
            gstNumber:  { type: String },
        },
        orders:     [vendorPurchaseOrderSchema],
        createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
        isReplacement:  { type: Boolean, default: false },
        replacementFor: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseReturn", default: null },
        originalPurchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorPurchase", default: null },
        tenantId: { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

export default mongoose.model("VendorPurchase", vendorPurchaseSchema);
