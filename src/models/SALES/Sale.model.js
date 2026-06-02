import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
    {
        item: {
            type: String,
            required: true
        },

        amount: {
            type: Number,
            min: 0,
            required: true,
        },

        qty: {
            type: Number,
            min: 1,
            required: true,
        },

        discount: {
            type: Number,
            min: 0,
            default: 0,
        },

        subtotal: {
            type: Number,
            min: 0,
            default: 0,
        },

        gst: {
            type: Number,
            min: 0,
            default: 0,
            enum: [0, 5, 12, 18, 24],
        },

        gstAmt: {
            type: Number,
            min: 0,
            default: 0,
        },

        gstType: {
            type: String,
            default: "included",
            enum: ["included", "excluded"],
        },

        totalAmount: {
            type: Number,
            min: 0,
            required: true,
        },

        paymentMode: {
            // type: [String],
            type: String,
            enum: ["CASH", "CARD", "UPI"],
            default: "CASH",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        createdByName: String,
    },
    { timestamps: true }
);

export default mongoose.model("Sale", saleSchema);