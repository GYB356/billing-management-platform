const express = require('express');
const mongoose = require('mongoose');
const { sanitizeInput } = require('../security');
const Invoice = require('../models/invoice');
const Customer = require('../models/customer');
const asyncHandler = require('../middleware/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Middleware for validating invoice input
 */
const validateInvoiceInput = (req, res, next) => {
  const { customerId, amount, dueDate, items } = req.body;
  
  // Check required fields
  if (!customerId || !amount || !dueDate) {
    return next(new AppError('Missing required fields: customerId, amount, dueDate', 400));
  }
  
  // Validate amount
  if (isNaN(Number(amount)) || Number(amount) <= 0) {
    return next(new AppError('Invalid amount: must be a positive number', 400));
  }
  
  // Validate due date format
  const dueDateObj = new Date(dueDate);
  if (isNaN(dueDateObj.getTime())) {
    return next(new AppError('Invalid due date format', 400));
  }
  
  // Check if due date is in the past
  if (dueDateObj < new Date()) {
    return next(new AppError('Due date cannot be in the past', 400));
  }
  
  // Validate customerId format
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return next(new AppError('Invalid customer ID format', 400));
  }
  
  // Validate invoice items if provided
  if (items && Array.isArray(items)) {
    for (const [index, item] of items.entries()) {
      if (!item.description) {
        return next(new AppError(`Item at index ${index} missing description`, 400));
      }
      if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return next(new AppError(`Item at index ${index} has invalid quantity`, 400));
      }
      if (!item.unitPrice || isNaN(Number(item.unitPrice)) || Number(item.unitPrice) < 0) {
        return next(new AppError(`Item at index ${index} has invalid unit price`, 400));
      }
    }
  }
  
  next();
};

/**
 * Middleware for authentication
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized access', 401));
  }
  
  // In a real app, you'd validate the token
  // For this example, we're just checking that it exists
  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AppError('Unauthorized access', 401));
  }
  
  // Set user info on request object
  req.user = { id: '1', username: 'testuser' };
  
  next();
};

/**
 * Route Handlers
 */

// Create a new invoice
router.post('/', authenticate, validateInvoiceInput, asyncHandler(async (req, res) => {
  const { customerId, amount, dueDate, items, notes } = req.body;
  
  // Find customer
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new AppError(`Customer not found with ID: ${customerId}`, 404);
  }
  
  // Generate invoice number
  const invoiceNumber = await Invoice.generateInvoiceNumber();
  
  // Create invoice document
  const invoice = new Invoice({
    invoiceNumber,
    customer: customerId,
    items: items || [],
    status: 'pending',
    issueDate: new Date(),
    dueDate,
    notes: sanitizeInput(notes)
  });
  
  // Save to database
  await invoice.save();
  
  // Return created invoice
  return res.status(201).json(invoice);
}));

// Get all invoices with pagination
router.get('/', authenticate, asyncHandler(async (req, res) => {
  // Parse query parameters with defaults and limits
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;
  
  // Filter options
  const filter = {};
  
  // Add status filter if provided
  if (req.query.status && ['draft', 'pending', 'paid', 'overdue', 'cancelled'].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  
  // Add customer filter if provided
  if (req.query.customer && mongoose.Types.ObjectId.isValid(req.query.customer)) {
    filter.customer = req.query.customer;
  }
  
  // Add date range filter if provided
  if (req.query.startDate && req.query.endDate) {
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);
    
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      filter.issueDate = {
        $gte: startDate,
        $lte: endDate
      };
    }
  }
  
  // Execute query with pagination
  const invoices = await Invoice.find(filter)
    .populate('customer', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  // Get total count for pagination
  const total = await Invoice.countDocuments(filter);
  
  // Send response
  res.status(200).json({
    success: true,
    count: invoices.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: invoices
  });
}));

// Get invoice by ID
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const id = sanitizeInput(req.params.id);
  
  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid invoice ID format', 400);
  }
  
  // Find invoice
  const invoice = await Invoice.findById(id).populate('customer', 'name email address');
  
  // Check if invoice exists
  if (!invoice) {
    throw new AppError(`Invoice not found with ID: ${id}`, 404);
  }
  
  res.status(200).json(invoice);
}));

// Update invoice
router.put('/:id', authenticate, validateInvoiceInput, asyncHandler(async (req, res) => {
  const id = sanitizeInput(req.params.id);
  const { customerId, amount, dueDate, items, notes, status } = req.body;
  
  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid invoice ID format', 400);
  }
  
  // Validate status if provided
  if (status && !['draft', 'pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
    throw new AppError('Invalid status value', 400);
  }
  
  // Find customer
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new AppError(`Customer not found with ID: ${customerId}`, 404);
  }
  
  // Find invoice and update
  const updatedInvoice = await Invoice.findByIdAndUpdate(
    id,
    {
      customer: customerId,
      items: items || [],
      dueDate,
      notes: sanitizeInput(notes),
      status: status || 'pending',
      updatedAt: Date.now()
    },
    { new: true, runValidators: true }
  );
  
  // Check if invoice exists
  if (!updatedInvoice) {
    throw new AppError(`Invoice not found with ID: ${id}`, 404);
  }
  
  res.status(200).json(updatedInvoice);
}));

// Process payment for an invoice
router.post('/:id/payments', authenticate, asyncHandler(async (req, res) => {
  const id = sanitizeInput(req.params.id);
  const { amount, method } = req.body;
  
  // Validate required fields
  if (!amount || !method) {
    throw new AppError('Missing required fields: amount, method', 400);
  }
  
  // Validate method
  if (!['credit_card', 'bank_transfer', 'cash', 'check', 'other'].includes(method)) {
    throw new AppError('Invalid payment method', 400);
  }
  
  // Find invoice
  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new AppError(`Invoice not found with ID: ${id}`, 404);
  }
  
  // Verify amount matches
  if (Number(amount) !== invoice.total) {
    throw new AppError(`Payment amount (${amount}) does not match invoice total (${invoice.total})`, 400);
  }
  
  // Process payment
  await invoice.markAsPaid(method);
  
  // Create payment response
  const paymentResponse = {
    invoiceId: invoice._id,
    amount: invoice.total,
    status: 'success',
    method,
    transactionId: `TXN-${Date.now()}`,
    processedAt: invoice.paymentDate
  };
  
  res.status(201).json(paymentResponse);
}));

// Delete invoice (soft delete)
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const id = sanitizeInput(req.params.id);
  
  // Find invoice
  const invoice = await Invoice.findById(id);
  
  // Check if invoice exists
  if (!invoice) {
    throw new AppError(`Invoice not found with ID: ${id}`, 404);
  }
  
  // Update status to cancelled
  invoice.status = 'cancelled';
  await invoice.save();
  
  res.status(200).json({
    success: true,
    message: 'Invoice cancelled successfully'
  });
}));

module.exports = router; 