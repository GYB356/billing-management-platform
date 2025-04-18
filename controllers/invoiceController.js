const Invoice = require('../models/invoice');
const Customer = require('../models/customer');
const { AppError } = require('../middleware/errorHandler');
const APIFeatures = require('../utils/apiFeatures');

/**
 * Create a new invoice
 */
exports.createInvoice = async (req, res, next) => {
  // Check if customer exists
  const customer = await Customer.findById(req.body.customer);
  if (!customer) {
    return next(new AppError('Customer not found', 404));
  }

  // Calculate invoice total amount
  const totalAmount = req.body.items.reduce((total, item) => {
    return total + (item.quantity * item.unitPrice);
  }, 0);

  // Generate invoice number (simple implementation)
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  const invoiceNumber = lastInvoice 
    ? `INV-${parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1}`.padStart(10, '0') 
    : 'INV-0000000001';

  // Create the invoice
  const newInvoice = await Invoice.create({
    invoiceNumber,
    customer: req.body.customer,
    items: req.body.items,
    totalAmount,
    dueDate: req.body.dueDate,
    notes: req.body.notes,
    createdBy: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: {
      invoice: newInvoice
    }
  });
};

/**
 * Get all invoices with filtering, sorting, and pagination
 */
exports.getAllInvoices = async (req, res) => {
  // Create API features instance
  const features = new APIFeatures(Invoice.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Execute query
  const invoices = await features.query.populate('customer', 'name email');

  // Get total count for pagination (without pagination)
  const count = await Invoice.countDocuments(features.query._conditions);

  // Send response
  res.status(200).json({
    status: 'success',
    results: invoices.length,
    pagination: {
      total: count,
      page: req.query.page * 1 || 1,
      limit: req.query.limit * 1 || 100
    },
    data: {
      invoices
    }
  });
};

/**
 * Get a specific invoice by ID
 */
exports.getInvoice = async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id).populate('customer');

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      invoice
    }
  });
};

/**
 * Update an invoice
 */
exports.updateInvoice = async (req, res, next) => {
  // Check if invoice exists
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if status allows updates (don't allow updates to paid/cancelled invoices)
  if (['paid', 'cancelled'].includes(invoice.status)) {
    return next(new AppError(`Cannot update invoice with status: ${invoice.status}`, 400));
  }

  // If customer is being changed, verify new customer exists
  if (req.body.customer && req.body.customer !== invoice.customer.toString()) {
    const customer = await Customer.findById(req.body.customer);
    if (!customer) {
      return next(new AppError('New customer not found', 404));
    }
  }

  // Calculate new total if items are updated
  if (req.body.items) {
    req.body.totalAmount = req.body.items.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);
  }

  // Update the invoice
  const updatedInvoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    { ...req.body, lastModifiedBy: req.user._id },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      invoice: updatedInvoice
    }
  });
};

/**
 * Delete an invoice (soft delete)
 */
exports.deleteInvoice = async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Soft delete by updating status to cancelled
  invoice.status = 'cancelled';
  invoice.lastModifiedBy = req.user._id;
  await invoice.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
};

/**
 * Process a payment for an invoice
 */
exports.processPayment = async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  if (invoice.status === 'paid') {
    return next(new AppError('Invoice already paid', 400));
  }

  if (invoice.status === 'cancelled') {
    return next(new AppError('Cannot pay a cancelled invoice', 400));
  }

  // Record payment
  invoice.payments.push({
    amount: req.body.amount,
    method: req.body.method,
    date: Date.now(),
    recordedBy: req.user._id
  });

  // Calculate total paid amount
  const totalPaid = invoice.payments.reduce((total, payment) => total + payment.amount, 0);

  // Update invoice status based on payment
  if (totalPaid >= invoice.totalAmount) {
    invoice.status = 'paid';
    invoice.paidAt = Date.now();
  } else {
    invoice.status = 'partial';
  }

  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: {
      invoice
    }
  });
};

/**
 * Get invoice statistics (admin/manager only)
 */
exports.getInvoiceStats = async (req, res) => {
  const stats = await Invoice.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Calculate overdue invoices
  const overdueInvoices = await Invoice.countDocuments({
    status: { $in: ['pending', 'partial'] },
    dueDate: { $lt: new Date() }
  });

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      overdue: overdueInvoices
    }
  });
};

/**
 * Mark overdue invoices (admin/manager only)
 */
exports.markOverdueInvoices = async (req, res) => {
  // Find all invoices that are pending or partial and past due date
  const result = await Invoice.updateMany(
    {
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lt: new Date() }
    },
    {
      $set: { status: 'overdue', lastModifiedBy: req.user._id }
    }
  );

  res.status(200).json({
    status: 'success',
    message: `${result.nModified} invoices marked as overdue`
  });
}; 