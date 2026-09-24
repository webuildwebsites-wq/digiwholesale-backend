import mongoose from "mongoose";

const externalOrderItemSchema = new mongoose.Schema(
  {
    side:            { type: String, enum: ["R", "L"] },
    sph:             Number,
    cyl:             Number,
    axis:            Number,
    add:             Number,
    itemName:        { type: String, trim: true },
    productName:     { type: String, trim: true },
    batchNumber:     { type: String, trim: true, default: "" },
    unit:            { type: String, trim: true, default: "" },
    category:        { type: String, trim: true, default: "" },
    brand:           { type: String, trim: true, default: "" },
    code:            { type: String, trim: true, default: "" },
    color:           { type: String, trim: true, default: "" },
    size:            { type: String, trim: true, default: "" },
    shape:           { type: String, trim: true, default: "" },
    material:        { type: String, trim: true, default: "" },
    dimensions:      { type: String, trim: true, default: "" },
    photos:          { type: [String], default: [] },
    qty:             { type: Number, default: 1 },
    quantity:        { type: Number, default: 1 },
    price:           { type: Number, default: 0 },
    sellingPrice:    { type: Number, default: 0 },
    buyingPrice:     { type: Number, default: 0 },
    gst:             { type: Number, default: 0 },
    hsnSac:          { type: String, trim: true, default: "" },
    mrp:             { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    subTotal:        { type: Number, default: 0 },
    expectedDate:    { type: Date, default: null },
    index:           { type: Number, default: null },
    tint:            { type: String, trim: true, default: "" },
    coating:         { type: String, trim: true, default: "" },
    expiry:          { type: String, trim: true, default: "" },
    disposability:   { type: String, trim: true, default: "" },
    orderReference:  { type: String, default: "" },
    powerType:       { type: String, default: "" },
    productMode:     { type: String, default: "" },
    hasPrism:        { type: Boolean, default: false },
    treatment:       { type: String, default: "" },
    tintDetails:     { type: String, default: "" },
    remarks:         { type: String, default: "" },
  },
  { _id: false }
);

const externalOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type:   String,
      unique: true,
      sparse: true,
      index:  true,
    },

    wholesalerTenantId: {
      type:      String,
      required:  true,
      trim:      true,
      uppercase: true,
      index:     true,
    },

    retailerTenantId: {
      type:      String,
      trim:      true,
      uppercase: true,
      index:     true,
      default:   "DIGI-RETAILER",
    },
    retailerStoreName: {
      type:    String,
      trim:    true,
      default: "",
    },
    retailerMobile: {
      type:    String,
      trim:    true,
      default: "",
    },
    retailerEmail: {
      type:      String,
      lowercase: true,
      trim:      true,
      default:   "",
    },

    items:                 { type: [externalOrderItemSchema], default: [] },
    estimatedDeliveryDate: { type: Date, default: null },
    cgst:                  { type: String, default: "0" },
    sgst:                  { type: String, default: "0" },
    totalGst:              { type: Number, default: 0 },
    subtotal:              { type: Number, default: 0 },
    grossTotal:            { type: Number, default: 0 },
    advanceAmount:         { type: Number, default: 0 },
    shippingCharges:       { type: Number, default: 0 },
    otherCharges:          { type: Number, default: 0 },
    netPayableTotal:       { type: Number, default: 0 },
    grossTotalWithCharges: { type: Number, default: 0 },
    orderReference:        { type: String, trim: true, default: "" },
    remarks:               { type: String, trim: true, default: "" },
    shippingAddress:       { type: String, trim: true, default: "" },

    status: {
      type:    String,
      enum:    [
        "Submitted",
        "Processing",
        "QC",
        "ReadyToDispatch",
        "Dispatched",
        "Delivered",
        "Completed",
        "Cancelled",
      ],
      default: "Submitted",
      index:   true,
    },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true }
);

externalOrderSchema.index({ wholesalerTenantId: 1, createdAt: -1 });
externalOrderSchema.index({ retailerTenantId: 1, createdAt: -1 });
externalOrderSchema.index({ orderReference: 1 });

export default mongoose.model("ExternalOrder", externalOrderSchema);
