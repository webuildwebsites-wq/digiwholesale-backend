import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
  {
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters'],
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      maxlength: [150, 'Account holder name cannot exceed 150 characters'],
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
      maxlength: [50, 'Account number cannot exceed 50 characters'],
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'IFSC code cannot exceed 20 characters'],
    },
    branchName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [150, 'Branch name cannot exceed 150 characters'],
    },
    accountType: {
      type: String,
      enum: ['Current', 'Savings', 'OD/CC'],
      default: 'Current',
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'UPI ID cannot exceed 100 characters'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'employee',
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
  }
);

bankAccountSchema.virtual('name').get(function () {
  return `${this.bankName} - ${this.accountNumber ? this.accountNumber.slice(-4) : ''} (${this.accountType || 'A/C'})`;
});

bankAccountSchema.index({ accountNumber: 1, tenantId: 1 }, { unique: true });
bankAccountSchema.index({ isActive: 1 });
bankAccountSchema.index({ tenantId: 1 });

export default mongoose.model('BankAccount', bankAccountSchema);

