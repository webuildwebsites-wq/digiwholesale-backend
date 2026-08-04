import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        allCategories:   { type: [String], default: [] },
        gst:             { type: [String], default: [] },
        paymentFor:      { type: [String], default: [] },
        salesPaymentFor: { type: [String], default: [] },
        status:          { type: [String], default: [] },
        transactionType: { type: [String], default: [] },
    },
    {
        timestamps: true,
        strict: false,
    }
);

export default mongoose.model("Settings", settingsSchema);
