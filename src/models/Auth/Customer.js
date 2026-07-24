import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Counter from "./Counter.js";
import billToAddressSchema from "./Customer/BillToAddress.js";
import shipToAddressSchema from "./Customer/ShipToAddress.js"

const flatFittingSchema = new mongoose.Schema(
  {
    selectType: {
      name: { type: String, required: true },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FittingCenter",
      },
    },
    index: {
      name: { type: String, required: true },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FittingIndex",
      },
    },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    // BASIC DETAILS
    shopName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    businessType: {
      name: {
        type: String,
        required: false,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessType',
        required: false
      }
    },
    orderMode: {
      type: String,
      default : "online"
    },
    mobileNo1: {
      type: String,
      match: [/^[0-9]{10}$/, "Invalid mobile number"],
    },
    mobileNo2: {
      type: String,
      match: [/^[0-9]{10}$/, "Invalid mobile number"],
    },
    businessEmail: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid businessEmail']
    },

    // Address details
    billToAddress: {
      type: billToAddressSchema,
      required: true,
    },


    // LOGIN DETAILS
    customerCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    zone: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
      }
    },
    brands: {
      type: [{
        brandId:   { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
        brandName: { type: String, trim: true },
      }],
      default: [],
      _id: false,
    },

    flatFittingData: {
      type: [flatFittingSchema],
      default: [],
    },
    specificLab: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpecificLab',
      }
    },
    brandCategories: {
      type: [{
        brandName: {
          type: String,
        },
        brandId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Brand',
        },
        categories: [{
          categoryName: {
            type: String,
          },
          categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
          }
        }]
      }],
      default: [],
    },
    salesPerson: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'employee',
      }
    },


    // DOCUMENTATION DETAILS
    isGSTRegistered: {
      type: Boolean,
      required: true,
    },
    gstType: {
      name: {
        type: String,
        required: function () {
          return this.isGSTRegistered === true;
        },
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GSTType'
      }
    },
    gstNumber: {
      type: String,
      uppercase: true,
      required: function () {
        return this.isGSTRegistered === true;
      },
    },
    gstCertificateImg: {
      type: String,
      required: function () {
        return this.isGSTRegistered === true;
      },
    },
    panCard: {
      type: String,
      required: function () {
        return this.isGSTRegistered === false;
      },
    },
    aadharCard: {
      type: String,
      required: function () {
        return this.isGSTRegistered === false;
      },
    },
    panCardImg: {
      type: String,
      required: function () {
        return this.isGSTRegistered === false;
      },
    },
    aadharCardImg: {
      type: String,
      required: function () {
        return this.isGSTRegistered === false;
      },
    },


    // BUSINESS DETAILS
    plant: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plant',
      }
    },
    lab: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lab'
      }
    },
    fittingCenter: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FittingCenter',
      }
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    customerBalance: {
      type: Number,
      default: 0,
    },
    creditDays: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CreditDay',
      }
    },
    courierName: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourierName',
      }
    },
    courierTime: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourierTime',
      }
    },
    dcWithoutValue: {
      type: Boolean,
      default: false,
    },
    yearOfEstablishment: {
      type: Number,
      required: false,
      min: 1900,
      max: new Date().getFullYear()
    },
    proposedDiscount: {
      type: Number,
      required: false,
      min: 0,
      max: 100
    },
    currentlyDealtBrands: {
      type: String,
      required: false,
      trim: true
    },
    minSalesValue: {
      type: Number,
      required: false,
      min: 0
    },
    finalDiscount: {
      type: Number,
      min: 0,
      max: 100
    },
    proprietorName: {
      type: String,
      trim: true,
      required: true,
    },
    firmName: {
      type: String,
      trim: true,
    },
    chequeDetails: {
      type: [{
        chequeNumber: {
          type: String,
          required: false,
          trim: true,
          default: ""
        },
        chequeImage: {
          type: String,
          required: false,
          default: ""
        }
      }],
      validate: {
        validator: function (value) {
          if (!value || value.length === 0) return true;
          return value.length === 3;
        },
        message: 'chequeDetails must have exactly 3 entries if provided'
      }
    },
    chequeRemark: {
      type: String,
      trim: true,
      default: ""
    },
    billingCycle: {
      type: String,
      enum: ['7_days', '15_days', 'end_of_month', 'custom']
    },
    billingMode: {
      type: String,
      enum: ['Direct', 'DC'],
    },
    // Workflow Status
    approvalWorkflow: {
      financeApprovalStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'MODIFICATION_REQUIRED'],
        default: 'PENDING'
      },
      financeApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'employee'
      },
      financeApprovedAt: Date,
      financeRemark: String,

      salesHeadApprovalStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'MODIFICATION_REQUIRED'],
        default: 'PENDING'
      },
      salesHeadApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'employee'
      },
      salesHeadApprovedAt: Date,
      salesHeadRemark: String,
    },
    isBlacklisted: {
      type: Boolean,
      default: false
    },
    blacklistReason: {
      type: String,
      trim: true,
      required: function () {
        return this.isBlacklisted === true;
      }
    },
    termsAndConditionsAccepted: {
      type: Boolean,
      default: false
    },
    termsAcceptedAt: Date,
    status: {
      isSuspended: {
        type: Boolean,
        default: false
      },
      isActive: {
        type: Boolean,
        default: false,
      },
      suspensionReason: String,
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
  
    
    // SYSTEM INTERNAL DETAILS
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employee",
      required: true,
    },
    createdByName: {
      type: String,
      trim: true,
    },
    createdByDepartment: {
      type: String,
      enum: ['SALES', 'FINANCE', 'SUPERADMIN'],
      required: true,
    },
    correctionRequest: {
      fieldsToCorrect: [{
        type: String
      }],
      remark: {
        type: String
      },
      requestedEmployeeName : {
        type: String
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "employee",
      },
      requestedAt: {
        type: Date
      },
      correctionNeededBy: {
        type: String,
        enum: ['SALES', 'FINANCE'],
      }
    },
    customerShipToDetails : [shipToAddressSchema],
    emailOtp: String,
    emailOtpExpires: Date,
    mobileOtp: String,
    mobileOtpExpires: Date,
    designation: {
      type: String,
      default: "Customer",
    },
    serialNumber: {
      type: Number,
      unique: true
    },
  },
  { timestamps: true }
);

customerSchema.pre("save", async function () {
  if (this.isNew && !this.serialNumber) {
    try {
      this.serialNumber = await Counter.getNextSequence('customer_serial');
    } catch (error) {
      throw error;
    }
  }

  if (!this.isModified("password") || !this.password) return;
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

customerSchema.pre('save', function () {
  try {
    if (this.isModified('isDeleted') && this.isDeleted === true) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      this.expireAt = expiryDate;

      console.log(`Customer ${this.shopName} will be automatically deleted on ${expiryDate.toISOString()}`);
    }

    if (this.isModified('isDeleted') && this.isDeleted === false) {
      this.expireAt = null;
      console.log(`Customer ${this.shopName} restored - automatic deletion cancelled`);
    }
  } catch (error) {
    console.log("Error : ", error);
    throw error;
  }
});

customerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

customerSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expireAt: { $ne: null } } });
const Customer = mongoose.model('Customer', customerSchema);
export default Customer;