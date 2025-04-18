const mongoose = require('mongoose');

/**
 * Invoice Schema
 * Represents invoices with proper validation, indexing, and relationships
 */

// Invoice Item Schema (sub-document)
const InvoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  }
}, { _id: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual for item total price
InvoiceItemSchema.virtual('total').get(function() {
  return (this.quantity * this.unitPrice).toFixed(2) * 1; // Convert to number
});

// Payment Schema (sub-document)
const PaymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0.01, 'Payment amount must be greater than 0']
  },
  method: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: {
      values: ['credit_card', 'bank_transfer', 'cash', 'check', 'other'],
      message: 'Payment method must be one of: credit_card, bank_transfer, cash, check, other'
    }
  },
  date: {
    type: Date,
    default: Date.now
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Payment notes cannot exceed 200 characters']
  },
  transactionId: {
    type: String,
    trim: true
  }
}, { _id: true });

// Main Invoice Schema
const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true,
    index: true, // Index for quick lookup by invoice number
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required'],
    index: true, // Index for customer lookups
  },
  items: {
    type: [InvoiceItemSchema],
    required: [true, 'Invoice must have at least one item'],
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'Invoice must have at least one item'
    }
  },
  totalAmount: {
    type: Number,
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'pending', 'partial', 'paid', 'overdue', 'cancelled'],
      message: 'Status must be one of: draft, pending, partial, paid, overdue, cancelled'
    },
    default: 'pending',
    index: true, // Index for status filters
  },
  issueDate: {
    type: Date,
    default: Date.now,
    index: true, // Index for date range queries
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(date) {
        // Due date must be after or equal to issue date
        return date >= this.issueDate;
      },
      message: 'Due date must be after or equal to issue date'
    },
    index: true, // Index for due date filters (for overdue invoices)
  },
  paidAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  payments: {
    type: [PaymentSchema],
    default: []
  },
  // User tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for commonly used filters
InvoiceSchema.index({ customer: 1, status: 1 });
InvoiceSchema.index({ status: 1, dueDate: 1 });
InvoiceSchema.index({ issueDate: 1, dueDate: 1 });

// Auto-calculate total amount before saving
InvoiceSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
  next();
});

// Virtual for total paid amount
InvoiceSchema.virtual('paidAmount').get(function() {
  if (!this.payments || this.payments.length === 0) return 0;
  return this.payments.reduce((sum, payment) => sum + payment.amount, 0);
});

// Virtual for remaining amount
InvoiceSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.totalAmount - this.paidAmount);
});

// Virtual for is overdue flag
InvoiceSchema.virtual('isOverdue').get(function() {
  return (
    ['pending', 'partial'].includes(this.status) && 
    this.dueDate < new Date() && 
    this.remainingAmount > 0
  );
});

// Method to mark invoice as paid
InvoiceSchema.methods.markAsPaid = async function(userId) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.lastModifiedBy = userId;
  return this.save();
};

// Method to mark invoice as overdue
InvoiceSchema.methods.markAsOverdue = async function(userId) {
  this.status = 'overdue';
  this.lastModifiedBy = userId;
  return this.save();
};

// Static method to find overdue invoices
InvoiceSchema.statics.findOverdueInvoices = function() {
  return this.find({
    status: { $in: ['pending', 'partial'] },
    dueDate: { $lt: new Date() }
  });
};

// Static method to generate a unique invoice number
InvoiceSchema.statics.generateInvoiceNumber = async function() {
  const lastInvoice = await this.findOne({}, {}, { sort: { 'invoiceNumber': -1 } });
  
  let nextNumber = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }
  
  return `INV-${nextNumber.toString().padStart(8, '0')}`;
};

const Invoice = mongoose.model('Invoice', InvoiceSchema);

module.exports = Invoice;
