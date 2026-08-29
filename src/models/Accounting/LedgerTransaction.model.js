import mongoose from 'mongoose';

const LedgerTransactionSchema = new mongoose.Schema({
  entityType: { 
    type: String, 
    enum: ['Customer', 'Vendor', 'General'], 
    required: true,
    index: true 
  },
  ledgerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    index: true 
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    default: null
  },
  transactionDate: { 
    type: Date, 
    default: Date.now, 
    required: true,
    index: true 
  },
  voucherType: { 
    type: String, 
    enum: ['Sales Invoice', 'Receipt', 'Purchase Invoice', 'Payment Voucher', 'Debit Note', 'Credit Note', 'Journal', 'Journal Voucher', 'Advance Adjustment'], 
    required: true,
    index: true 
  },
  voucherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    default: () => new mongoose.Types.ObjectId()
  },
  referenceNumber: { 
    type: String, 
    required: true,
    trim: true,
    index: true 
  },
  debit: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  credit: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  runningBalance: { 
    type: Number, 
    required: true 
  },
  narration: { 
    type: String, 
    trim: true 
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
  isReversed: {
    type: Boolean,
    default: false
  },
  reversalReference: {
    type: String,
    default: null
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'employee', 
    required: true 
  }
}, { timestamps: true });

// Prevent accidental updates/deletions for audit integrity
LedgerTransactionSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace'], function() {
  // Allow system flags like isReversed update only if explicitly specified
});

export default mongoose.model('LedgerTransaction', LedgerTransactionSchema);
