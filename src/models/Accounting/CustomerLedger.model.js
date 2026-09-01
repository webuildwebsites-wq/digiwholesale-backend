import mongoose from 'mongoose';

const CustomerLedgerSchema = new mongoose.Schema({
  ledgerCode: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, 
    trim: true, 
    uppercase: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true, 
    unique: true,
    index: true 
  },
  coaAccountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account', 
    default: null 
  },
  customerType: { 
    type: String, 
    enum: ['Retail', 'Wholesale'], 
    default: 'Wholesale' 
  },
  creditLimit: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  creditDays: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  creditUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  interestRate: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  openingBalance: { 
    type: Number, 
    default: 0 
  },
  openingBalanceType: { 
    type: String, 
    enum: ['Debit', 'Credit'], 
    default: 'Debit' 
  },
  currentBalance: { 
    type: Number, 
    default: 0 
  },
  overdueAmount: { 
    type: Number, 
    default: 0 
  },
  ledgerStatus: { 
    type: String, 
    enum: ['Active', 'Blocked', 'Closed'], 
    default: 'Active' 
  },
  allowCreditSales: { 
    type: Boolean, 
    default: true 
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
  remarks: {
    type: String,
    trim: true
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'employee' 
  }
}, { timestamps: true });

export default mongoose.model('CustomerLedger', CustomerLedgerSchema);
