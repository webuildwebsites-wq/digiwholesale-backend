import mongoose from "mongoose";

const billingCurrencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Billing currency name is required"],
      trim: true,
      maxlength: [100, "Billing currency name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employee",
      required: true,
    },
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.id;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.id;
        return ret;
      }
    }
  }
);

billingCurrencySchema.index({ name: 1, tenantId: 1 }, { unique: true });
billingCurrencySchema.index({ isActive: 1 });

export default mongoose.model("BillingCurrency", billingCurrencySchema);
