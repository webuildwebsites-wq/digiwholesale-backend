import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────
// 1. Initial Lens Generation History Schema
// ─────────────────────────────────────────────────────────────
export const lensGenerationHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      default: "GENERATED",
    },
    totalLenses: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalStockQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    sphRange: {
      type: String,
      default: "",
      trim: true,
    },
    cylRange: {
      type: String,
      default: "",
      trim: true,
    },
    buyingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────
// 2. Lens Matrix Updates (Price / Quantity / Delete) Schema
// ─────────────────────────────────────────────────────────────
export const lensUpdateHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["GENERATED", "UPDATE_PRICE", "UPDATE_QTY", "DELETE", "UPDATE"],
      default: "UPDATE",
    },
    priceType: {
      type: String,
      default: "",
      trim: true,
    },
    totalLenses: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalStockQty: {
      type: Number,
      default: 0,
    },
    sphRange: {
      type: String,
      default: "",
      trim: true,
    },
    cylRange: {
      type: String,
      default: "",
      trim: true,
    },
    buyingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

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
      trim: true,
      default: "",
    },

    colors: [
      {
        color: {
          type: String,
          trim: true,
        },
        qty: {
          type: Number,
          default: 0,
          min: 0,
        },
        productColorImage: {
          type: String,
          default: "",
        },
      },
    ],

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

    disposability: {
      type: String,
    },

    expiry: {
      type: Date,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    buyingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    sellingPrice: {
      type: Number,
      min: 0,
      default: 0,
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
    orderSource: {
      type: String,
      enum: ["INHOUSE", "ORDER"],
      default: "INHOUSE",
    },
    vendor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
      name: { type: String, default: null },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
    // 1. Initial Lens Generation History
    lensGenerationHistory: {
      type: [lensGenerationHistorySchema],
      default: undefined,
    },

    // 2. Matrix Updates / Price & Stock Changes History
    lensUpdateHistory: {
      type: [lensUpdateHistorySchema],
      default: undefined,
    },

    // Combined / Legacy Lens History (backward compatibility)
    lensHistory: {
      type: [lensUpdateHistorySchema],
      default: undefined,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    tenantId: { type: String, trim: true, uppercase: true, default: null, index: true },
  },
  { timestamps: true }
);

const DigiProduct = mongoose.model("DigiProduct", productSchema);
export default DigiProduct;