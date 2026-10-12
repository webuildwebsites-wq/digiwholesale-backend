import mongoose from "mongoose";

const lensHistorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      uppercase: true,
      default: "LENS",
    },
    // Schema Type: GENERATION (initial series creation) vs UPDATE (price/qty/delete)
    historyType: {
      type: String,
      enum: ["GENERATION", "UPDATE"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["GENERATED", "UPDATE_PRICE", "UPDATE_QTY", "DELETE", "UPDATE"],
      required: true,
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employee",
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

lensHistorySchema.index({ tenantId: 1, productName: 1, createdAt: -1 });
lensHistorySchema.index({ tenantId: 1, createdAt: -1 });

const LensHistory = mongoose.model("LensHistory", lensHistorySchema);
export default LensHistory;
