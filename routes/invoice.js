const express = require('express');
const mongoose = require('mongoose');
const { sanitizeInput } = require('../security');
const Invoice = require('../models/invoice');
const Customer = require('../models/customer');
const asyncHandler = require('../middleware/asyncHandler');
const { AppError } = require('../middleware/errorHandler');
const { invoiceValidation } = require('../middleware/validator');
const { protect, restrictTo } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const invoiceController = require('../controllers/invoiceController');

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

// Protect all invoice routes - require authentication
router.use(protect);

// Apply rate limiting to POST requests
router.post('/', createLimiter, invoiceValidation.create, asyncHandler(invoiceController.createInvoice));

// Routes for getting all invoices with filters and pagination
router.get('/', invoiceValidation.getAll, asyncHandler(invoiceController.getAllInvoices));

// Routes for specific invoice by ID
router.route('/:id')
  .get(invoiceValidation.getById, asyncHandler(invoiceController.getInvoice))
  .patch(invoiceValidation.update, asyncHandler(invoiceController.updateInvoice))
  .delete(invoiceValidation.delete, asyncHandler(invoiceController.deleteInvoice));

// Routes for invoice payments
router.post('/:id/payment', invoiceValidation.payment, asyncHandler(invoiceController.processPayment));

// Routes requiring admin or manager privileges
router.get('/stats', restrictTo('admin', 'manager'), asyncHandler(invoiceController.getInvoiceStats));
router.post('/mark-overdue', restrictTo('admin', 'manager'), asyncHandler(invoiceController.markOverdueInvoices));

module.exports = router; 