import mongoose from 'mongoose';

const AllocationSchema = new mongoose.Schema({
  invoiceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  invoiceNumber: { 
    type: String, 
    required: true 
  },
  invoiceModel: {
    type: String,
    enum: ['bulkOrders', 'Order', 'Sale', 'VendorPurchase'],
    default: 'bulkOrders'
  },
  invoiceTotal: {
    type: Number,
    default: 0
  },
  allocatedAmount: { 
    type: Number, 
    required: true,
    min: 0 
  }
}, { _id: false });

const PaymentSchema = new mongoose.Schema({
  paymentNumber: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  type: { 
    type: String, 
    enum: ['CUSTOMER_INFLOW', 'VENDOR_OUTFLOW'], 
    required: true 
  },
  partyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    refPath: 'partyModel',
    index: true 
  },
  partyModel: { 
    type: String, 
    enum: ['Customer', 'Vendor'], 
    required: true 
  },
  partyName: {
    type: String,
    trim: true
  },
  paymentMode: { 
    type: String, 
    enum: ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'ADVANCE_ADJUSTMENT'], 
    required: true 
  },
  grossAmount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  tdsDeducted: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  tdsSection: {
    type: String,
    default: null
  },
  debitNoteDeducted: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  debitNoteIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseReturn'
  }],
  netAmountPaid: { 
    type: Number, 
    required: true,
    min: 0 
  },
  allocations: [AllocationSchema],
  advanceAmount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  paymentDetails: {
    utrNumber: { type: String, trim: true },
    receiverUpiId: { type: String, trim: true },
    senderUpiId: { type: String, trim: true },
    chequeNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    chequeDate: { type: Date },
    clearanceDate: { type: Date },
    bounceDate: { type: Date },
    bounceReason: { type: String, trim: true },
    bouncePenaltyDebited: { type: Number, default: 0 },
    cashVoucherNo: { type: String, trim: true },
    collectedByEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'employee' },
    collectedByName: { type: String, trim: true },
    screenshotUrl: { type: String, trim: true },
    remarks: { type: String, trim: true }
  },
  status: { 
    type: String, 
    enum: ['DRAFT', 'PENDING_VERIFICATION', 'RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'COMPLETED', 'CANCELLED'], 
    default: 'COMPLETED',
    index: true 
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
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'employee', 
    required: true 
  }
}, { timestamps: true });

export default mongoose.model('Payment', PaymentSchema);
