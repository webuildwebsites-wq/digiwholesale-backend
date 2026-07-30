import mongoose from "mongoose";

const gstTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "GST type name is required"],
      trim: true,
      maxlength: [100, "GST type name cannot exceed 100 characters"],
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

gstTypeSchema.index({ name: 1 }, { unique: true });
gstTypeSchema.index({ isActive: 1 });

export default mongoose.model("GSTType", gstTypeSchema);
