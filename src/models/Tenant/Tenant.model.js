import mongoose from "mongoose";

const brandingSchema = new mongoose.Schema(
    {
        logo:        { type: String, default: null },
        banner:      { type: String, default: null },
        themeColor:  { type: String, default: "#1e40af" },
        description: { type: String, default: null },
        website:     { type: String, default: null },
    },
    { _id: false }
);

const tenantSchema = new mongoose.Schema(
    {
        tenantId: {
            type:     String,
            unique:   true,
            required: true,
            trim:     true,
            uppercase: true,
        },

        businessName:   { type: String, required: true, trim: true },
        gstNumber:      { type: String, trim: true, uppercase: true, default: null },
        contactPerson:  { type: String, required: true, trim: true },
        mobile:         { type: String, required: true, trim: true },
        email:          { type: String, required: true, trim: true, lowercase: true, unique: true },
        address:        { type: String, trim: true, default: null },
        state:          { type: String, trim: true, default: null },
        city:           { type: String, trim: true, default: null },
        pincode:        { type: String, trim: true, default: null },

        branding:       { type: brandingSchema, default: () => ({}) },

        subscription: {
            plan:      { type: String, enum: ["TRIAL", "BASIC", "PRO", "ENTERPRISE"], default: "TRIAL" },
            expiresAt: { type: Date, default: null },
            isActive:  { type: Boolean, default: true },
        },

        status: {
            type:    String,
            enum:    ["ACTIVE", "SUSPENDED", "INACTIVE", "PENDING"],
            default: "ACTIVE",
        },

        suspensionReason: { type: String, default: null },
        createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: "PlatformOwner", default: null },
    },
    { timestamps: true }
);

tenantSchema.index({ tenantId: 1 });
tenantSchema.index({ email: 1 });
tenantSchema.index({ status: 1 });

export default mongoose.model("Tenant", tenantSchema);
