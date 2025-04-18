/**
 * Centralized validation middleware using express-validator
 */
const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');
const mongoose = require('mongoose');

// Helper to check if a string is a valid MongoDB ObjectId
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

// Helper to process validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = errors.array().map(err => ({
    field: err.path,
    message: err.msg
  }));

  const errorMessage = extractedErrors.map(err => `${err.field}: ${err.message}`).join(', ');
  return next(new AppError(errorMessage, 400));
};

/**
 * Auth validation rules
 */
const authValidation = {
  login: [
    body('email')
      .exists().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address'),
    body('password')
      .exists().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    validate
  ],
  register: [
    body('firstName')
      .exists().withMessage('First name is required')
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .exists().withMessage('Last name is required')
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .exists().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .exists().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirmPassword')
      .exists().withMessage('Confirm password is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    validate
  ],
  resetPassword: [
    body('token')
      .exists().withMessage('Token is required')
      .isString().withMessage('Invalid token format'),
    body('password')
      .exists().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirmPassword')
      .exists().withMessage('Confirm password is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    validate
  ],
  updatePassword: [
    body('currentPassword')
      .exists().withMessage('Current password is required'),
    body('password')
      .exists().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirmPassword')
      .exists().withMessage('Confirm password is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    validate
  ],
  updateMe: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password').not().exists().withMessage('This route is not for password updates. Please use /update-password'),
    validate
  ]
};

/**
 * Invoice validation rules
 */
const invoiceValidation = {
  create: [
    body('customer')
      .exists().withMessage('Customer reference is required')
      .custom(isValidObjectId).withMessage('Invalid customer ID format'),
    body('items')
      .exists().withMessage('Invoice items are required')
      .isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.description')
      .exists().withMessage('Item description is required')
      .isString().withMessage('Description must be a string')
      .trim()
      .isLength({ min: 3, max: 200 }).withMessage('Description must be between 3 and 200 characters'),
    body('items.*.quantity')
      .exists().withMessage('Item quantity is required')
      .isNumeric().withMessage('Quantity must be a number')
      .custom(value => value > 0).withMessage('Quantity must be greater than 0'),
    body('items.*.unitPrice')
      .exists().withMessage('Unit price is required')
      .isNumeric().withMessage('Unit price must be a number')
      .custom(value => value >= 0).withMessage('Unit price cannot be negative'),
    body('dueDate')
      .exists().withMessage('Due date is required')
      .isISO8601().withMessage('Invalid date format')
      .custom(value => new Date(value) > new Date()).withMessage('Due date must be in the future'),
    body('notes')
      .optional()
      .isString().withMessage('Notes must be a string')
      .trim()
      .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    validate
  ],
  update: [
    param('id')
      .exists().withMessage('Invoice ID is required')
      .custom(isValidObjectId).withMessage('Invalid invoice ID format'),
    body('customer')
      .optional()
      .custom(isValidObjectId).withMessage('Invalid customer ID format'),
    body('items')
      .optional()
      .isArray().withMessage('Items must be an array'),
    body('items.*.description')
      .optional()
      .isString().withMessage('Description must be a string')
      .trim()
      .isLength({ min: 3, max: 200 }).withMessage('Description must be between 3 and 200 characters'),
    body('items.*.quantity')
      .optional()
      .isNumeric().withMessage('Quantity must be a number')
      .custom(value => value > 0).withMessage('Quantity must be greater than 0'),
    body('items.*.unitPrice')
      .optional()
      .isNumeric().withMessage('Unit price must be a number')
      .custom(value => value >= 0).withMessage('Unit price cannot be negative'),
    body('dueDate')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
    body('status')
      .optional()
      .isIn(['draft', 'pending', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status value'),
    body('notes')
      .optional()
      .isString().withMessage('Notes must be a string')
      .trim()
      .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    validate
  ],
  getById: [
    param('id')
      .exists().withMessage('Invoice ID is required')
      .custom(isValidObjectId).withMessage('Invalid invoice ID format'),
    validate
  ],
  delete: [
    param('id')
      .exists().withMessage('Invoice ID is required')
      .custom(isValidObjectId).withMessage('Invalid invoice ID format'),
    validate
  ],
  getAll: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['draft', 'pending', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status value'),
    query('customer')
      .optional()
      .custom(isValidObjectId).withMessage('Invalid customer ID format'),
    query('startDate')
      .optional()
      .isISO8601().withMessage('Start date must be in ISO format'),
    query('endDate')
      .optional()
      .isISO8601().withMessage('End date must be in ISO format')
      .custom((value, { req }) => {
        if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    validate
  ],
  payment: [
    param('id')
      .exists().withMessage('Invoice ID is required')
      .custom(isValidObjectId).withMessage('Invalid invoice ID format'),
    body('amount')
      .exists().withMessage('Payment amount is required')
      .isNumeric().withMessage('Amount must be a number')
      .custom(value => value > 0).withMessage('Amount must be greater than 0'),
    body('method')
      .exists().withMessage('Payment method is required')
      .isIn(['credit_card', 'bank_transfer', 'cash', 'check', 'other']).withMessage('Invalid payment method'),
    validate
  ]
};

/**
 * Customer validation rules
 */
const customerValidation = {
  create: [
    body('name')
      .exists().withMessage('Customer name is required')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .exists().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('phone')
      .optional()
      .matches(/^\+?[\d\s-()]{10,15}$/).withMessage('Invalid phone number format'),
    body('address.street')
      .optional()
      .isString().withMessage('Street must be a string')
      .trim(),
    body('address.city')
      .optional()
      .isString().withMessage('City must be a string')
      .trim(),
    body('address.state')
      .optional()
      .isString().withMessage('State must be a string')
      .trim(),
    body('address.zipCode')
      .optional()
      .isString().withMessage('Zip code must be a string')
      .trim(),
    body('address.country')
      .optional()
      .isString().withMessage('Country must be a string')
      .trim(),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'pending']).withMessage('Invalid status value'),
    validate
  ],
  update: [
    param('id')
      .exists().withMessage('Customer ID is required')
      .custom(isValidObjectId).withMessage('Invalid customer ID format'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .optional()
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('phone')
      .optional()
      .matches(/^\+?[\d\s-()]{10,15}$/).withMessage('Invalid phone number format'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'pending']).withMessage('Invalid status value'),
    validate
  ],
  getById: [
    param('id')
      .exists().withMessage('Customer ID is required')
      .custom(isValidObjectId).withMessage('Invalid customer ID format'),
    validate
  ],
  delete: [
    param('id')
      .exists().withMessage('Customer ID is required')
      .custom(isValidObjectId).withMessage('Invalid customer ID format'),
    validate
  ]
};

module.exports = {
  authValidation,
  invoiceValidation,
  customerValidation
}; 