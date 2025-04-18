const mongoose = require('mongoose');

/**
 * Invoice Line Item Sub-Schema
 * Embedded within the Invoice schema
 */
const LineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Line item description is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0'],
    default: 1
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative']
  },
  taxRate: {
    type: Number,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%'],
    default: 0
  },
  taxAmount: {
    type: Number,
    min: [0, 'Tax amount cannot be negative'],
    default: 0
  }
}, { _id: true }); // Each line item gets its own ID

// Calculate line item amount before saving
LineItemSchema.pre('save', function(next) {
  this.amount = this.quantity * this.unitPrice;
  this.taxAmount = this.amount * (this.taxRate / 100);
  next();
});

/**
 * Invoice Schema
 * Represents an invoice in the system with relationship to Customer
 */
const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required']
  },
  items: [LineItemSchema],
  subtotal: {
    type: Number,
    min: [0, 'Subtotal cannot be negative'],
    default: 0
  },
  taxTotal: {
    type: Number,
    min: [0, 'Tax total cannot be negative'],
    default: 0
  },
  total: {
    type: Number,
    min: [0, 'Total cannot be negative'],
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  issueDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Issue date is required']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(value) {
        // Due date must be on or after issue date
        return !this.issueDate || value >= this.issueDate;
      },
      message: 'Due date must be on or after the issue date'
    }
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'cash', 'check', 'other'],
    trim: true
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for days until due or overdue
InvoiceSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(this.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Indexes for frequently queried fields
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ customer: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ dueDate: 1 });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ 'items.description': 'text' }); // Text index for searching items

// Calculate totals before saving
InvoiceSchema.pre('save', function(next) {
  // Calculate subtotal and tax total from line items
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
    this.taxTotal = this.items.reduce((sum, item) => sum + item.taxAmount, 0);
    this.total = this.subtotal + this.taxTotal;
  }
  
  // Update status if paid
  if (this.paymentDate && this.status !== 'paid') {
    this.status = 'paid';
  }
  
  // Check for overdue invoices
  if (
    !this.paymentDate &&
    this.status !== 'paid' &&
    this.status !== 'cancelled' &&
    this.dueDate < new Date() &&
    this.status !== 'overdue'
  ) {
    this.status = 'overdue';
  }
  
  this.updatedAt = Date.now();
  next();
});

// Static method to find invoices by status
InvoiceSchema.statics.findByStatus = function(status) {
  return this.find({ status }).populate('customer', 'name email');
};

// Static method to find overdue invoices
InvoiceSchema.statics.findOverdue = function() {
  const today = new Date();
  return this.find({
    status: { $nin: ['paid', 'cancelled'] },
    dueDate: { $lt: today }
  }).populate('customer', 'name email');
};

// Instance method to mark as paid
InvoiceSchema.methods.markAsPaid = function(paymentMethod, paymentDate = new Date()) {
  this.status = 'paid';
  this.paymentMethod = paymentMethod;
  this.paymentDate = paymentDate;
  this.updatedAt = Date.now();
  return this.save();
};

// Static method to generate invoice number
InvoiceSchema.statics.generateInvoiceNumber = async function() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  // Find the latest invoice with this prefix
  const prefix = `INV-${year}${month}-`;
  const latestInvoice = await this.findOne(
    { invoiceNumber: new RegExp(`^${prefix}`) },
    { invoiceNumber: 1 },
    { sort: { invoiceNumber: -1 } }
  );
  
  // Extract the sequence number or start at 1
  let sequenceNumber = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const match = latestInvoice.invoiceNumber.match(/(\d+)$/);
    if (match && match[1]) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }
  
  // Format the sequence number with leading zeros
  const sequence = String(sequenceNumber).padStart(4, '0');
  return `${prefix}${sequence}`;
};

const Invoice = mongoose.model('Invoice', InvoiceSchema);

module.exports = Invoice;
