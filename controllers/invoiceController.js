const Invoice = require('../models/invoice');
const { AppError } = require('../middleware/errorHandler');
const { validateInvoiceInput } = require('../utils/validation');
const { cacheMiddleware } = require('../middleware/cache');

// Wrap async functions to avoid try-catch blocks
const catchAsync = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

exports.createInvoice = catchAsync(async (req, res) => {
  // Validate input
  const validatedData = await validateInvoiceInput(req.body);
  
  const invoice = await Invoice.create({
    ...validatedData,
    createdBy: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: { invoice }
  });
});

exports.getInvoices = catchAsync(async (req, res) => {
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Build query
  const query = Invoice.find()
    .populate('customer', 'name email')
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);

  // Add filters
  if (req.query.status) {
    query.where('status').equals(req.query.status);
  }
  if (req.query.customer) {
    query.where('customer').equals(req.query.customer);
  }

  // Execute query with total count
  const [invoices, total] = await Promise.all([
    query,
    Invoice.countDocuments()
  ]);

  res.json({
    status: 'success',
    results: invoices.length,
    pagination: {
      page,
      pages: Math.ceil(total / limit),
      total
    },
    data: { invoices }
  });
});

exports.getInvoice = catchAsync(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer', 'name email')
    .populate('createdBy', 'name');

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  res.json({
    status: 'success',
    data: { invoice }
  });
});

exports.updateInvoice = catchAsync(async (req, res) => {
  // Validate input
  const validatedData = await validateInvoiceInput(req.body);

  const invoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    {
      ...validatedData,
      lastModifiedBy: req.user._id
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  res.json({
    status: 'success',
    data: { invoice }
  });
});

exports.deleteInvoice = catchAsync(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // Check if invoice can be deleted (e.g., not paid)
  if (invoice.status === 'paid') {
    throw new AppError('Paid invoices cannot be deleted', 400);
  }

  await invoice.remove();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Dashboard data with proper aggregation
exports.getDashboardData = catchAsync(async (req, res) => {
  const [invoices, stats] = await Promise.all([
    Invoice.find()
      .populate('customer', 'name')
      .sort('-createdAt')
      .limit(5),
    Invoice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ])
  ]);

  res.json({
    status: 'success',
    data: {
      recentInvoices: invoices,
      stats
    }
  });
});