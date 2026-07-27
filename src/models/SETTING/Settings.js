import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        allCategories:   [String],
        gst:             [String],
        paymentFor:      [String],
        salesPaymentFor: [String],
        status:          [String],
        transactionType: [String],
        tenantId:        { type: String, trim: true, uppercase: true, default: null, index: true },
    },
    { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
