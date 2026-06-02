import mongoose from "mongoose";


const settingsSchema = new mongoose.Schema(
    {
        allCategories: [String],
        gst: [String],
        paymentFor: [String],
        salesPaymentFor: [String],
        status: [String],
        transactionType: [String],
    },
    { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);