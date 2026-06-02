import mongoose from "mongoose";


const settingsSchema = new mongoose.Schema(
    {
        storeNumber: {
            type: String,
            required: true,
        },
        storeName: {
            type: String,
            required: true,
        },
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