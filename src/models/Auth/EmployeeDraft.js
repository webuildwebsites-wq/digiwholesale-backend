import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const subRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { _id: false },
);

const employee = new mongoose.Schema(
  {
    employeeName: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      select: false,
    },
    phone: {
      type: String,
    },
    address: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    EmployeeType: {
      type: String,
      trim: true,
    },
    ProfilePicture: {
      type: String,
      trim: true,
      default: null,
    },
    Department: {
      name: {
        type: String,
        trim: true,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
      },
    },
    subRoles: [subRoleSchema],
    // lab: {
    //   name: {
    //     type: String,
    //     trim: true,
    //   },
    //   refId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Lab",
    //   },
    // },
    zone: {
      name: {
        type: String,
        trim: true,
        uppercase: true,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
      },
    },
    aadharCard: {
      type: String,
      trim: true,
    },
    panCard: {
      type: String,
      trim: true,
    },
    aadharCardImg: {
      type: String,
      trim: true,
    },
    panCardImg: {
      type: String,
      trim: true,
    },
    expiry: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employee",
    },
    supervisor: {
      name: {
        type: String,
        trim: true,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "employee",
      },
    },
    teamLead: {
      name: {
        type: String,
        trim: true,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "employee",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'employee',
      default: null
    },
    expireAt: {
      type: Date,
      default: null
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    profile: {
      dateOfJoining: {
        type: Date,
        default: Date.now,
      },
      dateOfBirth: {
        type: Date,
      },
      emergencyContact: {
        name: String,
        phone: {
          type: String,

        },
        relation: String,
      },
    },
    lastLogin: {
      type: Date,
    },
    lockUntil: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    employeeProfileImg: {
      type: String,
      trim: true,
      default: null
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        return ret;
      },
    },
  },
);

employee.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

employee.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    console.log("Error : ", error);
    throw error;
  }
});

employee.pre('save', function () {
  try {
    if (this.isModified('isDeleted') && this.isDeleted === true) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      this.expireAt = expiryDate;

      console.log(`Employee Draft will be automatically deleted on ${expiryDate.toISOString()}`);
    }

    if (this.isModified('isDeleted') && this.isDeleted === false) {
      this.expireAt = null;
      console.log(`Employee Draft restored - automatic deletion cancelled`);
    }
  } catch (error) {
    console.log("erorr : ", error);
    throw error;
  }
});

employee.index({ expireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expireAt: { $ne: null } } });
const employeeDraftSchema = mongoose.model('employeeDraft', employee);
export default employeeDraftSchema;