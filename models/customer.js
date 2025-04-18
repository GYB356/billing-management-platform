const mongoose = require('mongoose');

/**
 * Address Sub-Schema
 * Embedded within the Customer schema
 */
const AddressSchema = new mongoose.Schema({
  street: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true,
    default: 'USA'
  }
}, { _id: false });

/**
 * Customer Schema
 * Represents a customer in the system
 */
const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Basic phone validation - can be customized based on requirements
        return /^\+?[\d\s-()]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: AddressSchema,
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true // Once set, createdAt cannot be changed
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: false, updatedAt: true }, // Auto-update the updatedAt field
  toJSON: { virtuals: true }, // Include virtuals when converting to JSON
  toObject: { virtuals: true }
});

// Virtual for full address
CustomerSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  
  const { street, city, state, zipCode, country } = this.address;
  const parts = [street, city, state, zipCode, country].filter(Boolean);
  return parts.join(', ');
});

// Indexes for frequently queried fields
CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ name: 1 });
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ 'address.zipCode': 1 });

// Pre-save middleware
CustomerSchema.pre('save', function(next) {
  // Any processing before saving
  this.updatedAt = Date.now();
  next();
});

// Static method to find customers by status
CustomerSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Instance method to update status
CustomerSchema.methods.updateStatus = function(status) {
  this.status = status;
  this.updatedAt = Date.now();
  return this.save();
};

const Customer = mongoose.model('Customer', CustomerSchema);

module.exports = Customer; 