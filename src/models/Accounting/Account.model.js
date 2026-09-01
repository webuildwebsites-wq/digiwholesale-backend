import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema({
  accountCode: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    trim: true,
    uppercase: true
  },
  accountName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  accountNature: { 
    type: String, 
    enum: ['Asset', 'Liability', 'Income', 'Expense', 'Capital'], 
    required: true 
  },
  accountType: { 
    type: String, 
    enum: ['General Ledger', 'Customer', 'Vendor', 'Bank', 'Cash', 'Tax', 'Inventory', 'Expense', 'Income'], 
    required: true 
  },
  parentAccount: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account', 
    default: null 
  },
  branchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Location', 
    default: null 
  },
  tenantId: { 
    type: String, 
    trim: true, 
    uppercase: true, 
    default: null, 
    index: true 
  },
  isControlAccount: { 
    type: Boolean, 
    default: false 
  },
  allowManualJournal: { 
    type: Boolean, 
    default: false 
  },
  gstApplicable: { 
    type: Boolean, 
    default: false 
  },
  openingBalance: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'employee' 
  }
}, { timestamps: true });

export default mongoose.model('Account', AccountSchema);
