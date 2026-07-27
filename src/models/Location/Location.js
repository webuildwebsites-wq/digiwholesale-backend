import mongoose from 'mongoose';

const zipCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true,
    match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit zip code']
  },
  area: {
    type: String,
    trim: true,
    maxlength: [200, 'Area name cannot exceed 200 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'City name is required'],
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'City code is required'],
    uppercase: true,
    trim: true,
    maxlength: [20, 'City code cannot exceed 20 characters']
  },
  zipCodes: [zipCodeSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const stateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'State name is required'],
    trim: true,
    maxlength: [100, 'State name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'State code is required'],
    uppercase: true,
    trim: true,
    maxlength: [20, 'State code cannot exceed 20 characters']
  },
  cities: [citySchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const locationSchema = new mongoose.Schema({
  zone: {
    type: String,
    required: [true, 'Zone is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [2, 'Zone name must be at least 2 characters'],
    maxlength: [50, 'Zone name cannot exceed 50 characters'],
    index: true
  },
  states: [stateSchema],
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  regionalManager: {
    name: {
      type: String,
      trim: true
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'employee'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'employee', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'employee' },
  tenantId:  { type: String, trim: true, uppercase: true, default: null, index: true },
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) { delete ret.id; return ret; }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) { delete ret.id; return ret; }
  }
});

// Indexes for efficient querying
locationSchema.index({ zone: 1, isActive: 1 }, { unique: true });
locationSchema.index({ 'states.name': 1 });
locationSchema.index({ 'states.cities.name': 1 });
locationSchema.index({ 'states.cities.zipCodes.code': 1 });
locationSchema.index({ 'regionalManager.refId': 1 });

locationSchema.virtual('statesCount').get(function() {
  return this.states ? this.states.filter(s => s.isActive).length : 0;
});

locationSchema.virtual('citiesCount').get(function() {
  if (!this.states) return 0;
  return this.states.reduce((count, state) => {
    return count + (state.cities ? state.cities.filter(c => c.isActive).length : 0);
  }, 0);
});

locationSchema.virtual('zipCodesCount').get(function() {
  if (!this.states) return 0;
  return this.states.reduce((count, state) => {
    if (!state.cities) return count;
    return count + state.cities.reduce((cityCount, city) => {
      return cityCount + (city.zipCodes ? city.zipCodes.filter(z => z.isActive).length : 0);
    }, 0);
  }, 0);
});

locationSchema.methods.findState = function(stateName) {
  return this.states.find(s => s.name === stateName && s.isActive);
};

locationSchema.methods.findCity = function(stateName, cityName) {
  const state = this.findState(stateName);
  if (!state) return null;
  return state.cities.find(c => c.name === cityName && c.isActive);
};

locationSchema.methods.findZipCode = function(stateName, cityName, zipCode) {
  const city = this.findCity(stateName, cityName);
  if (!city) return null;
  return city.zipCodes.find(z => z.code === zipCode && z.isActive);
};

locationSchema.statics.findByZone = function(zone) {
  return this.findOne({ zone: zone.toUpperCase(), isActive: true });
};

locationSchema.statics.findByState = function(stateName) {
  return this.findOne({ 
    'states.name': stateName,
    'states.isActive': true,
    isActive: true 
  });
};

locationSchema.statics.findByCity = function(cityName) {
  return this.findOne({ 
    'states.cities.name': cityName,
    'states.cities.isActive': true,
    isActive: true 
  });
};

locationSchema.statics.findByZipCode = function(zipCode) {
  return this.findOne({ 
    'states.cities.zipCodes.code': zipCode,
    'states.cities.zipCodes.isActive': true,
    isActive: true 
  });
};

const Location = mongoose.model('Location', locationSchema);

export default Location;
