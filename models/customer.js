const mongoose = require('mongoose');
const validator = require('validator');

/**
 * Customer Schema
 * Represents business customers with proper indexing and validation
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

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
    index: true // Index for faster search by name
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address'],
    index: true // Index for faster lookup by email
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^\+?[\d\s-()]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: {
    type: AddressSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'pending'],
      message: 'Status must be either: active, inactive, or pending'
    },
    default: 'active',
    index: true // Index for filtering by status
  },
  taxId: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  active: {
    type: Boolean,
    default: true,
    select: false // Hide active status by default
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for number of invoices (not stored in DB)
CustomerSchema.virtual('invoices', {
  ref: 'Invoice',
  localField: '_id',
  foreignField: 'customer',
  count: true // Just count them
});

// Compound index for better performance on common query patterns
CustomerSchema.index({ status: 1, createdAt: -1 });
CustomerSchema.index({ name: 'text', email: 'text' }); // Text search index

// Query middleware to exclude inactive customers by default
CustomerSchema.pre(/^find/, function(next) {
  this.find({ active: { $ne: false } });
  next();
});

// Static method to find customers with outstanding invoices
CustomerSchema.statics.findWithOutstandingInvoices = async function() {
  const Invoice = mongoose.model('Invoice');

  // Aggregate to find customers with unpaid invoices
  const customersWithUnpaid = await Invoice.aggregate([
    {
      $match: { status: { $in: ['pending', 'overdue'] } }
    },
    {
      $group: {
        _id: '$customer',
        totalDue: { $sum: '$totalAmount' },
        invoiceCount: { $sum: 1 }
      }
    }
  ]);

  const customerIds = customersWithUnpaid.map(c => c._id);
  return this.find({ _id: { $in: customerIds } });
};

const Customer = mongoose.model('Customer', CustomerSchema);

module.exports = Customer;
