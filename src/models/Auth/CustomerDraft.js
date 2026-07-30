import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import draftBillToAddressSchema from "./Customer/Draft/DraftBillToAddress.js";
import draftShipToAddressSchema from "./Customer/Draft/DraftShipToAddress.js";

const flatFittingDraftSchema = new mongoose.Schema(
  {
    selectType: {
      name: { type: String },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FittingCenter",
      },
    },
    index: {
      name: { type: String },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FittingIndex",
      },
    },
    price: { type: Number },
  },
  { _id: false }
);

const customerDraftSchema = new mongoose.Schema(
  {
    // BASIC DETAILS
    shopName: {
      type: String,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
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
      default: "online"
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
      required: false,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid businessEmail']
    },

    // Address details
    billToAddress: {
      type: draftBillToAddressSchema,
      required: false,
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
    hasFlatFitting: {
      type: Boolean,
      default: false,
    },

    flatFittingData: {
      type: [flatFittingDraftSchema],
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
    },
    gstType: {
      name: {
        type: String,
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GSTType'
      }
    },
    gstNumber: {
      type: String,
      uppercase: true,
    },
    gstCertificateImg: {
      type: String,
    },
    panCard: {
      type: String,
    },
    aadharCard: {
      type: String,
    },
    panCardImg: {
      type: String,
    },
    aadharCardImg: {
      type: String,
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
    },
    firmName: {
      type: String,
      trim: true,
    },
    chequeDetails: {
      type: [{
        chequeNumber: {
          type: String,
          trim: true
        },
        chequeImage: {
          type: String,
        }
      }],
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
    },
    tenantId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    createdByDepartment: {
      type: String,
      enum: ['SALES', 'FINANCE', 'SUPERADMIN'],
    },
    correctionRequest: {
      fieldsToCorrect: [{
        type: String
      }],
      remark: {
        type: String
      },
      requestedEmployeeName: {
        type: String
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "employee",
      },
      requestedAt: {
        type: Date
      }
    },
    customerShipToDetails: [draftShipToAddressSchema],
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
      unique: true,
      sparse: true
    },
  },
  { timestamps: true }
);

customerDraftSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

customerDraftSchema.pre('save', function () {
  try {
    if (this.isModified('isDeleted') && this.isDeleted === true) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      this.expireAt = expiryDate;

      console.log(`Customer Draft ${this.shopName} will be automatically deleted on ${expiryDate.toISOString()}`);
    }

    if (this.isModified('isDeleted') && this.isDeleted === false) {
      this.expireAt = null;
      console.log(`Customer Draft ${this.shopName} restored - automatic deletion cancelled`);
    }
  } catch (error) {
    console.log("Error : ", error);
    throw error;
  }
});

customerDraftSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

customerDraftSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expireAt: { $ne: null } } });
const CustomerDraft = mongoose.model('CustomerDraft', customerDraftSchema);
export default CustomerDraft;
