const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { customerValidation } = require('../middleware/validator');
const { protect } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const customerController = require('../controllers/customerController');

// Protect all customer routes - require authentication
router.use(protect);

// Routes for customers
router.route('/')
  .get(asyncHandler(customerController.getAllCustomers))
  .post(createLimiter, customerValidation.create, asyncHandler(customerController.createCustomer));

router.route('/:id')
  .get(customerValidation.getById, asyncHandler(customerController.getCustomer))
  .patch(customerValidation.update, asyncHandler(customerController.updateCustomer))
  .delete(customerValidation.delete, asyncHandler(customerController.deleteCustomer));

// Get all invoices for a specific customer
router.get('/:id/invoices', customerValidation.getById, asyncHandler(customerController.getCustomerInvoices));

module.exports = router; 