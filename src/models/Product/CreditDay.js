import mongoose from "mongoose";

const creditDaySchema = new mongoose.Schema(
  {
    days: {
      type: Number,
      required: [true, "Credit days is required"],
      min: [0, "Credit days cannot be negative"],
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

creditDaySchema.index({ days: 1 }, { unique: true });
creditDaySchema.index({ isActive: 1 });

export default mongoose.model("CreditDay", creditDaySchema);
