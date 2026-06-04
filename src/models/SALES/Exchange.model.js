import mongoose from "mongoose";

/* ─────────────────────────────────────────
   Sub-schema: item being returned/exchanged
───────────────────────────────────────── */
const exchangeItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },        // item name / description
    qty: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, enum: [0, 5, 12, 18, 24] },
    gstType: {
      type: String,
      default: "excluded",
      enum: ["included", "excluded"],
    },
  },
  { _id: false }
);

/* ─────────────────────────────────────────
   Sub-schema: new product selected by customer
   (mirrors relevant fields from Order model)
───────────────────────────────────────── */
const newProductSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    brand: { id: mongoose.Schema.Types.ObjectId, name: String },
    category: { id: mongoose.Schema.Types.ObjectId, name: String },
    productName: { id: mongoose.Schema.Types.ObjectId, name: String },
    coating: { id: mongoose.Schema.Types.ObjectId, name: String },
    treatment: { id: mongoose.Schema.Types.ObjectId, name: String },
    index: Number,
    price: { type: Number, default: 0 },
    remarks: String,
  },
  { _id: false }
);

/* ─────────────────────────────────────────
   Main Exchange schema
───────────────────────────────────────── */
const exchangeSchema = new mongoose.Schema(
  {
    /* ---------- Basic Info ---------- */
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },

    /* ---------- Eligibility ---------- */
    dateOfPurchase: { type: Date, required: true },
    itemType: { type: String, required: true },
    condition: { type: String, required: true },
    reasonForExchange: { type: String, required: true },

    /* ---------- Items being returned ---------- */
    items: { type: [exchangeItemSchema], required: true },

    /* ---------- New product selected ---------- */
    newProduct: { type: newProductSchema, default: null },

    /* ---------- Price difference ---------- */
    // (+) customer pays extra  |  (-) store refunds difference
    priceDifference: { type: Number, default: 0 },
    priceDifferenceMode: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "NIL"],
      default: "NIL",
    },

    /* ---------- Photos ---------- */
    photos: [{ type: String }], // GCS URLs (max 10)

    /* ---------- Status ---------- */
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed"],
      default: "Pending",
      index: true,
    },

    remark: { type: String },

    /* ---------- Audit ---------- */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Exchange", exchangeSchema);
