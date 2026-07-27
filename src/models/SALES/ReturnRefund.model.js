import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, enum: [0, 5, 12, 18, 24] },
    gstType: {
      type: String,
      default: "EXCLUDED",
      enum: ["INCLUDED", "EXCLUDED"],
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "DigiProduct" },
    orderNumber: { type: String },
    returnType: { type: String },
    category: { type: String },
  },
  { _id: false }
);

const returnRefundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },

    dateOfPurchase: { type: Date, required: true },
    itemType: { type: String, required: true },
    condition: { type: String, required: true },
    reasonForReturn: { type: String, required: true },

    items: { type: [returnItemSchema], required: true },

    refundAmount: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      required: true,
      enum: ["CASH", "CARD", "UPI", "LOYALTY_POINTS", "GIFT_VOUCHER"],
    },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    giftVoucherUrl: { type: String, default: null }, 

    photos: [{ type: String }], 

    status: {
      type: String,
      enum: ["Pending", "Return_Approved", "Refund_Approved", "Rejected", "Completed"],
      default: "Pending",
      index: true,
    },

    remark: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
    tenantId: { type: String, trim: true, uppercase: true, default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("ReturnRefund", returnRefundSchema);
