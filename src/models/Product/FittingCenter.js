import mongoose from "mongoose";

const fittingCenterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Fitting center name is required"],
      trim: true,
      maxlength: [100, "Fitting center name cannot exceed 100 characters"],
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

fittingCenterSchema.index({ name: 1, tenantId: 1 }, { unique: true });
fittingCenterSchema.index({ isActive: 1 });

export default mongoose.model("FittingCenter", fittingCenterSchema);
