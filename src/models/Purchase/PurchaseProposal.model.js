import mongoose from "mongoose";

const quotationItemSchema = new mongoose.Schema(
    {
        price:           { type: Number, required: true, min: 0 },
        availableQty:    { type: Number, required: true, min: 0 },
        deliveryDays:    { type: Number, default: null },
        deliveryDetails: { type: String, default: "" },
        gst:             { type: Number, default: 0 },
        hsnSac:          { type: String, default: "" },
        remarks:         { type: String, default: "" },
    },
);

const vendorQuotationSchema = new mongoose.Schema(
    {
        vendorId:    { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        vendorName:  { type: String, required: true },
        email:       { type: String, default: "" },
        mobile:      { type: String, default: "" },
        quotation:   { type: quotationItemSchema, default: null },
        quotedAt:    { type: Date, default: null },
        status: {
            type:    String,
            enum:    ["PENDING", "QUOTED", "SELECTED", "REJECTED"],
            default: "PENDING",
        },
        rejectionReason: { type: String, default: "" },
    },
);

const purchaseProposalSchema = new mongoose.Schema(
    {
        proposalNumber: { type: String, required: true, trim: true },

        product: {
            productId:   { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct", default: null },
            productCode: { type: String, default: "" },
            productName: { type: String, required: true, trim: true },
            category:    { type: String, default: "" },
            brand:       { type: String, default: "" },
            unit:        { type: String, enum: ["PIECE", "PAIR", "BOX"], default: "PIECE" },
            currentQty:  { type: Number, default: 0 },
        },

        requiredQty:    { type: Number, required: true, min: 1 },
        requiredByDate: { type: Date, default: null },
        description:    { type: String, default: "" },

        vendorQuotations: [vendorQuotationSchema],

        status: {
            type:    String,
            enum:    ["DRAFT", "SENT", "QUOTED", "FINALIZED", "ORDERED", "CANCELLED"],
            default: "DRAFT",
        },

        selectedVendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
        finalPurchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorPurchase", default: null },

        createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "employee", required: true },
        createdByName: { type: String, default: "" },
        tenantId:      { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

purchaseProposalSchema.index({ proposalNumber: 1, tenantId: 1 });
purchaseProposalSchema.index({ status: 1, tenantId: 1 });

export default mongoose.model("PurchaseProposal", purchaseProposalSchema);
