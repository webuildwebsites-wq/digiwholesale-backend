import mongoose from 'mongoose';

const subRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  subRoles: [subRoleSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'employee' },
  tenantId:  { type: String, trim: true, uppercase: true, default: null, index: true },
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.id;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.id;
      return ret;
    }
  }
});

departmentSchema.index({ isActive: 1 });

export default mongoose.model('Department', departmentSchema);
