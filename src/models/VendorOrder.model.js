import mongoose from "mongoose";

const vendorOrderSchema = new mongoose.Schema(
  {

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    name: {
      type: String,
      required: true,
      uppercase: true,
    },

    mobile: {
      type: String,
      required: true,
    },

    email: {
      type: String,
    },

    subTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    gstTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["PENDING", "CANCELLED", "RETURN", "RECEIVED", "COMPLETED"],
      default: "PENDING",
      index: true,
    },

    notes: String,

    invoiceUrl: {
      type: String,
    },

    returnInvoiceUrl: {
      type: String,
    },

    tenantId: { type: String, trim: true, uppercase: true, default: null, index: true },

  },
  { timestamps: true }
);

export default mongoose.model("VendorOrder", vendorOrderSchema);
