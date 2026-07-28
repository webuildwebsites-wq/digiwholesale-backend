import mongoose from "mongoose";

const storeInformationSchema = new mongoose.Schema(
    {
        storeName:            { type: String, required: true, trim: true },
        address:              { type: String, required: true, trim: true },
        storeTiming:          { type: String, required: true, trim: true },
        commissionPercentage: { type: Number, required: true, min: 0, max: 100 },
        expiryDate:           { type: Date,   required: true },
        emailApi:             { type: String, trim: true, default: null },
        showAds:              { type: Boolean, default: false },
        hasGST:               { type: Boolean, default: false },
        hasAI:                { type: Boolean, default: false },
        storeLogo:            { type: String, trim: true, default: null },
    },
    { _id: false }
);

const ownerSchema = new mongoose.Schema(
    {
        ownerName: { type: String, required: true, trim: true },
        email:     { type: String, required: true, trim: true, lowercase: true },
        mobile:    { type: String, required: true, trim: true },
    },
    { _id: false }
);

const loyaltySchema = new mongoose.Schema(
    {
        rsPerPoint:   { type: Number, default: 0, min: 0 },
        pointValue:   { type: Number, default: 0, min: 0 },
        referPoints:  { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const documentsSchema = new mongoose.Schema(
    {
        gstCertificate: { type: String, trim: true, default: null },
        panCard:        { type: String, trim: true, default: null },
        aadhaarCard:    { type: String, trim: true, default: null },
    },
    { _id: false }
);

const ALL_PAGES = [
    "DASHBOARD", "REGISTER_CUSTOMER", "REGISTER_STAFF", "STAFF_LIST",
    "CUSTOMER_LIST", "SHIP_TO", "APPROVALS", "CORRECTIONS", "NEW_ORDER",
    "ALL_ORDERS", "PENDING_ORDERS", "OTHER_SALES", "SALES_LIST",
    "RETURN_REFUND", "EXCHANGE_REQUESTS", "DRAFTS", "DAILY_REPORT",
    "MAIN_REPORT", "ADD_REPAIR", "REPAIR_LIST", "ADD_VENDOR",
    "VENDOR_LIST", "VENDOR_ORDER", "QUALITY", "FITTING", "SHIPPING",
    "INVENTORY",
];

const PREMIUM_PAGES = [
    "DASHBOARD", "REGISTER_CUSTOMER", "CUSTOMER_LIST", "NEW_ORDER",
    "ALL_ORDERS", "SALES_LIST", "RETURN_REFUND", "INVENTORY",
];

const ALL_PERMISSIONS = [
    "ADD_STAFF", "UPDATE_STAFF", "DELETE_STAFF",
    "ADD_CUSTOMER", "UPDATE_CUSTOMER", "DELETE_CUSTOMER",
    "ADD_ORDER", "UPDATE_ORDER", "DELETE_ORDER", "APPROVE_ORDER",
    "ADD_DRAFT", "UPDATE_DRAFT", "DELETE_DRAFT",
    "ADD_REPAIR", "UPDATE_REPAIR", "DELETE_REPAIR",
    "ADD_VENDOR", "UPDATE_VENDOR", "DELETE_VENDOR",
    "UPDATE_QUALITY", "UPDATE_FITTING", "UPDATE_SHIPPING",
    "UPDATE_INVENTORY", "VIEW_REPORTS", "EXPORT_REPORTS",
];

const subscriptionSchema = new mongoose.Schema(
    {
        planType:          { type: String, enum: ["PRO", "PREMIUM", "CUSTOM"], default: "PRO" },
        expiresAt:         { type: Date, default: null },
        isActive:          { type: Boolean, default: true },
        selectedPages:     { type: [String], default: [] },
        autoPermissions:   { type: [String], default: [] },
    },
    { _id: false }
);

const whatsappConfigSchema = new mongoose.Schema(
    {
        utilityProvider:   { type: String, enum: ["META", "NON_META"], default: "META" },
        promotionProvider: { type: String, enum: ["META", "NON_META"], default: "META" },
    },
    { _id: false }
);

const tenantSchema = new mongoose.Schema(
    {
        tenantId: {
            type:      String,
            unique:    true,
            required:  true,
            trim:      true,
            uppercase: true,
        },

        storeInformation: { type: storeInformationSchema, required: true },
        owner:            { type: ownerSchema,            required: true },
        loyalty:          { type: loyaltySchema,          default: () => ({}) },
        documents:        { type: documentsSchema,        default: () => ({}) },
        subscription:     { type: subscriptionSchema,     default: () => ({}) },
        whatsappConfig:   { type: whatsappConfigSchema,   default: () => ({}) },

        status: {
            type:    String,
            enum:    ["ACTIVE", "SUSPENDED", "INACTIVE", "PENDING"],
            default: "ACTIVE",
        },

        suspensionReason: { type: String, default: null },
        createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: "employee", default: null },
    },
    { timestamps: true }
);

tenantSchema.index({ tenantId: 1 });
tenantSchema.index({ "owner.email": 1 });
tenantSchema.index({ status: 1 });

tenantSchema.statics.ALL_PAGES       = ALL_PAGES;
tenantSchema.statics.PREMIUM_PAGES   = PREMIUM_PAGES;
tenantSchema.statics.ALL_PERMISSIONS = ALL_PERMISSIONS;

export default mongoose.model("Tenant", tenantSchema);
