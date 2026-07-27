import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {

    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    firm: {
      type: String,
      trim: true,
      uppercase: true,
    },

    mobile: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      uppercase: true,
      trim: true,
    },

    gstNumber: {
      type: String,
      uppercase: true,
      trim: true,
    },

    paymentTerms: {
      type: String, // e.g. "30 DAYS", "CASH"
      trim: true,
      uppercase: true,
    },

    notes: {
      type: String,
      trim: true,
    },

    tenantId: { type: String, trim: true, uppercase: true, default: null, index: true },

  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);
