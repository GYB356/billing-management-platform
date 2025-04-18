const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { invoiceValidation } = require('../middleware/validator');
const { protect, restrictTo } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const invoiceController = require('../controllers/invoiceController');

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