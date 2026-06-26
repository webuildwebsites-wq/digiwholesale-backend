import mongoose from "mongoose";

const exchangeItemSchema = new mongoose.Schema(
  {
    item:       { type: String, required: true },
    qty:        { type: Number, required: true, min: 1 },
    amount:     { type: Number, required: true, min: 0 },
    discount:   { type: Number, default: 0, min: 0 },
    gst:        { type: Number, default: 0, enum: [0, 5, 12, 18, 24] },
    gstType:    { type: String, default: "EXCLUDED", enum: ["INCLUDED", "EXCLUDED"] },
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct" },
    category:   { type: String },
    orderNumber:{ type: String },
    images:     { type: [String], default: [] },
  },
  { _id: false }
);

const newProductSchema = new mongoose.Schema(
  {
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct", default: null },
    productCode: String,
    productName: String,
    category:    String,
    brand:       String,
    coating:     String,
    index:       String,
    price:       { type: Number, default: 0 },
    mrp:         { type: Number, default: 0 },
    remarks:     String,
  },
  { _id: false }
);

const exchangeSchema = new mongoose.Schema(
  {
    OrderId: { type: mongoose.Schema.Types.ObjectId, ref: "bulkOrders", required: true },

    name:              { type: String, required: true, trim: true },
    phone:             { type: String, required: true, trim: true },
    email:             { type: String, trim: true },
    dateOfPurchase:    { type: Date, required: true },
    itemType:          { type: String, required: true },
    condition:         { type: String, required: true },
    reasonForExchange: { type: String, required: true },

    items: { type: [exchangeItemSchema], required: true },

    newProduct:        { type: newProductSchema, default: null },
    newBulkOrderId:    { type: mongoose.Schema.Types.ObjectId, ref: "bulkOrders", default: null },

    priceDifference:     { type: Number, default: 0 },
    priceDifferenceMode: { type: String, enum: ["CASH", "CARD", "UPI", "NIL"], default: "NIL" },

    photos: [{ type: String }],

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed"],
      default: "Pending",
      index: true,
    },

    remark:        { type: String },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "employee" },
    createdByName: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Exchange", exchangeSchema);
