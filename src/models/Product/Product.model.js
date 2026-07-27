import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      required: true,
      trim: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    category: {
      type: String,
      required: true,
      uppercase: true,
    },

    brand: {
      type: String,
      uppercase: true,
    },

    image: {
      type: String,
      default: "",
    },

    color: {
      type: String,
      uppercase: true,
    },

    size: {
      type: String,
      uppercase: true,
    },

    type: {
      type: String,
      uppercase: true,
    },

    shape: {
      type: String,
      uppercase: true,
    },

    sph: {
      type: String,
      uppercase: true,
    },

    cyl: {
      type: String,
      uppercase: true,
    },

    index: {
      type: String,
      uppercase: true,
    },

    axis: {
      type: String,
      uppercase: true,
    },

    addition: {
      type: String,
    },

    material: {
      type: String,
      uppercase: true,
    },

    dimensions: {
      type: String,
      uppercase: true,
    },

    coating: {
      type: String,
      uppercase: true,
    },

    expiry: {
      type: Date,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    gst: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    hsnSac: {
      type: String,
    },

    mrp: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    qty: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
    tenantId: { type: String, trim: true, uppercase: true, default: null, index: true },
  },
  { timestamps: true }
);

const DigiProduct = mongoose.model("DigiProduct", productSchema);
export default DigiProduct;