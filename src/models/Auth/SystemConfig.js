import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  configType: {
    type: String,
    required: true,
    enum: ['EmployeeType', 'Lab', 'Region'],
    unique: true 
  },
  values: [{
    type: String,
    required: true,
    trim: true,
    uppercase: true
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'employee' },
  tenantId:  { type: String, trim: true, uppercase: true, default: null, index: true },
}, { timestamps: true });

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
