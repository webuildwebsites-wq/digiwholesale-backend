import mongoose from "mongoose";

const courierTimeSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
    time: {
      type: String,
      required: [true, "Time is required"],
      trim: true,
      maxlength: [50, "Time cannot exceed 50 characters"],
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

courierTimeSchema.index({ location: 1, time: 1 }, { unique: true });
courierTimeSchema.index({ isActive: 1 });

export default mongoose.model("CourierTime", courierTimeSchema);
