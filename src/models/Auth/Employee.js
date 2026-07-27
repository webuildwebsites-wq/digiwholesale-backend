import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Counter from './Counter.js';

const subRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId
  }
}, { _id: false });

const employee = new mongoose.Schema({
  employeeName: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true,
    minlength: [3, 'Employee name must be at least 3 characters'],
    maxlength: [50, 'Employee name cannot exceed 50 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [15, 'Username cannot exceed 15 characters']
  },
  employeeCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
    required: true
  },
  tenantId: {
    type:    String,
    trim:    true,
    uppercase: true,
    default: null,
    index:   true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  pincode: {
    type: String,
    trim: true,
  },
  EmployeeType: {
    type: String,
    required: [true, 'Employee type is required'],
    trim: true
  },
  ProfilePicture: {
    type: String,
    trim: true,
    default: null
  },
  Department: {
    name: {
      type: String,
      trim: true,
      required: function () {
        return this.EmployeeType !== 'SUPERADMIN';
      }
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: function () {
        return this.EmployeeType !== 'SUPERADMIN';
      }
    }
  },
  subRoles: [subRoleSchema],
  // lab: {
  //   name: {
  //     type: String,
  //     trim: true
  //   },
  //   refId: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'Lab'
  //   }
  // },
  zone: {
    name: {
      type: String,
      required: function () {
        const dept = this.Department?.name || this.Department;
        return ['EMPLOYEE', 'SUPERVISOR', 'TEAMLEAD'].includes(this.EmployeeType) && dept === 'SALES';
      },
      trim: true,
      uppercase: true
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: function () {
        const dept = this.Department?.name || this.Department;
        return ['EMPLOYEE', 'SUPERVISOR', 'TEAMLEAD'].includes(this.EmployeeType) && dept === 'SALES';
      }
    }
  },
  aadharCard: {
    type: String,
    trim: true
  },
  panCard: {
    type: String,
    trim: true
  },
  aadharCardImg: {
    type: String,
    trim: true
  },
  panCardImg: {
    type: String,
    trim: true
  },
  expiry: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'employee',
    required: function () {
      return !['SUPERADMIN'].includes(this.EmployeeType);
    }
  },
  supervisor: {
    name: {
      type: String,
      trim: true
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'employee'
    }
  },
  teamLead: {
    name: {
      type: String,
      trim: true
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'employee'
    }
  },
  teamLeadsUnderMe: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'employee'
  }],
  employeesUnderMe: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'employee'
  }],
  isActive: {
    type: Boolean,
    default: true
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
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },

  pageAccess: {
    type: [String],
    enum: [
      "DASHBOARD", "REGISTER_CUSTOMER", "REGISTER_STAFF", "STAFF_LIST",
      "CUSTOMER_LIST", "SHIP_TO", "APPROVALS", "CORRECTIONS", "NEW_ORDER",
      "ALL_ORDERS", "PENDING_ORDERS", "OTHER_SALES", "SALES_LIST",
      "RETURN_REFUND", "EXCHANGE_REQUESTS", "DRAFTS", "DAILY_REPORT",
      "MAIN_REPORT", "ADD_REPAIR", "REPAIR_LIST", "ADD_VENDOR",
      "VENDOR_LIST", "VENDOR_ORDER", "QUALITY", "FITTING", "SHIPPING",
      "INVENTORY",
    ],
    default: [],
  },

  accessPermissions: {
    type: [String],
    enum: [
      "ADD_STAFF", "UPDATE_STAFF", "DELETE_STAFF",
      "ADD_CUSTOMER", "UPDATE_CUSTOMER", "DELETE_CUSTOMER",
      "ADD_ORDER", "UPDATE_ORDER", "DELETE_ORDER", "APPROVE_ORDER",
      "ADD_DRAFT", "UPDATE_DRAFT", "DELETE_DRAFT",
      "ADD_REPAIR", "UPDATE_REPAIR", "DELETE_REPAIR",
      "ADD_VENDOR", "UPDATE_VENDOR", "DELETE_VENDOR",
      "UPDATE_QUALITY", "UPDATE_FITTING", "UPDATE_SHIPPING",
      "UPDATE_INVENTORY", "VIEW_REPORTS", "EXPORT_REPORTS",
    ],
    default: [],
  },

  profile: {
    dateOfJoining: {
      type: Date,
      default: Date.now
    },
    dateOfBirth: {
      type: Date
    },
    emergencyContact: {
      name: String,
      phone: {
        type: String,
        match: [/^[0-9]{10}$/, 'Invalid phone number format']
      },
      relation: String
    },
  },

  lastLogin: {
    type: Date
  },
  lockUntil: {
    type: Date
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  serialNumber: {
    type: Number,
    unique: true
  },
  employeeProfileImg: {
    type: String,
    trim: true,
    default: null
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.id;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.id;
      return ret;
    }
  }
});

employee.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

employee.pre('save', async function () {
  if (this.isNew && !this.serialNumber) {
    try {
      this.serialNumber = await Counter.getNextSequence('employee_serial');
    } catch (error) {
      throw error;
    }
  }

  if (!this.isModified('password') || !this.password) return;
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
      console.log(`Employee ${this.employeeName} will be automatically deleted on ${expiryDate.toISOString()}`);
    }

    if (this.isModified('isDeleted') && this.isDeleted === false) {
      this.expireAt = null;
      console.log(`Employee ${this.employeeName} restored - automatic deletion cancelled`);
    }
  } catch (error) {
    console.log("Error : ", error);
    throw error;
  }

});

employee.index({ expireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expireAt: { $ne: null } } });
const employeeSchema = mongoose.model('employee', employee);
export default employeeSchema;