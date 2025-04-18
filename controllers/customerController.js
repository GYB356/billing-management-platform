const Customer = require('../models/customer');
const Invoice = require('../models/invoice');
const { AppError } = require('../middleware/errorHandler');
const APIFeatures = require('../utils/apiFeatures');

/**
 * Create a new customer
 */
exports.createCustomer = async (req, res, next) => {
  // Check if customer with this email already exists
  const existingCustomer = await Customer.findOne({ email: req.body.email });
  if (existingCustomer) {
    return next(new AppError('Customer with this email already exists', 400));
  }

  // Create new customer
  const newCustomer = await Customer.create({
    ...req.body,
    createdBy: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: {
      customer: newCustomer
    }
  });
};

/**
 * Get all customers with filtering, sorting, and pagination
 */
exports.getAllCustomers = async (req, res) => {
  // Create API features instance
  const features = new APIFeatures(Customer.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Execute query
  const customers = await features.query;

  // Get total count for pagination (without pagination)
  const count = await Customer.countDocuments(features.query._conditions);

  // Send response
  res.status(200).json({
    status: 'success',
    results: customers.length,
    pagination: {
      total: count,
      page: req.query.page * 1 || 1,
      limit: req.query.limit * 1 || 100
    },
    data: {
      customers
    }
  });
};

/**
 * Get a specific customer by ID
 */
exports.getCustomer = async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return next(new AppError('No customer found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      customer
    }
  });
};

/**
 * Update a customer
 */
exports.updateCustomer = async (req, res, next) => {
  // Check if customer exists
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return next(new AppError('No customer found with that ID', 404));
  }

  // If email is being changed, check if new email is already in use
  if (req.body.email && req.body.email !== customer.email) {
    const existingCustomer = await Customer.findOne({ email: req.body.email });
    if (existingCustomer) {
      return next(new AppError('Email already in use by another customer', 400));
    }
  }

  // Update the customer
  const updatedCustomer = await Customer.findByIdAndUpdate(
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
      customer: updatedCustomer
    }
  });
};

/**
 * Delete a customer (soft delete)
 */
exports.deleteCustomer = async (req, res, next) => {
  // Check if customer exists
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return next(new AppError('No customer found with that ID', 404));
  }

  // Check if customer has any invoices
  const invoiceCount = await Invoice.countDocuments({ customer: req.params.id });
  if (invoiceCount > 0) {
    return next(new AppError('Cannot delete customer with existing invoices. Mark as inactive instead.', 400));
  }

  // Soft delete
  customer.status = 'inactive';
  customer.lastModifiedBy = req.user._id;
  await customer.save();

  res.status(204).json({
    status: 'success',
    data: null
  });
};

/**
 * Get all invoices for a specific customer
 */
exports.getCustomerInvoices = async (req, res, next) => {
  // Check if customer exists
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return next(new AppError('No customer found with that ID', 404));
  }

  // Create API features instance for invoices
  const features = new APIFeatures(Invoice.find({ customer: req.params.id }), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Execute query
  const invoices = await features.query;

  // Get total count
  const count = await Invoice.countDocuments({ customer: req.params.id, ...features.query._conditions });

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