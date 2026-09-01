import mongoose from 'mongoose';

const VendorLedgerSchema = new mongoose.Schema({
  ledgerCode: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    trim: true,
    uppercase: true 
  },
  vendorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true, 
    unique: true,
    index: true 
  },
  coaAccountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account', 
    default: null 
  },
  vendorCategory: { 
    type: String, 
    enum: ['Manufacturer', 'Distributor', 'Service Provider', 'Logistics', 'Lab', 'Equipment', 'Utility', 'Other'],
    default: 'Manufacturer'
  },
  tdsApplicable: { 
    type: Boolean, 
    default: false 
  },
  tdsSection: { 
    type: String, 
    default: null,
    trim: true 
  },
  tdsPercentage: {
    type: Number,
    default: 0,
    min: 0
  },
  gstin: { 
    type: String, 
    trim: true,
    uppercase: true 
  },
  pan: { 
    type: String, 
    trim: true,
    uppercase: true 
  },
  paymentTerms: { 
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
    default: 'Credit' 
  },
  currentOutstanding: { 
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

export default mongoose.model('VendorLedger', VendorLedgerSchema);
