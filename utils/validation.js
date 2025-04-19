const Joi = require('joi');
const sanitize = require('mongo-sanitize');
const { AppError } = require('../middleware/errorHandler');

const invoiceSchema = Joi.object({
  customer: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/),
  items: Joi.array().items(
    Joi.object({
      description: Joi.string().required().max(200),
      quantity: Joi.number().required().min(0.01),
      unitPrice: Joi.number().required().min(0)
    })
  ).min(1).required(),
  dueDate: Joi.date().required().min('now'),
  notes: Joi.string().max(500),
  status: Joi.string().valid('draft', 'pending', 'partial', 'paid', 'overdue', 'cancelled')
});

exports.validateInvoiceInput = async (data) => {
  // Sanitize input to prevent NoSQL injection
  const sanitizedData = sanitize(data);

  try {
    const value = await invoiceSchema.validateAsync(sanitizedData, {
      abortEarly: false,
      stripUnknown: true
    });
    return value;
  } catch (error) {
    throw new AppError(
      `Validation error: ${error.details.map(x => x.message).join(', ')}`,
      400
    );
  }
};

// Add more validation schemas as needed
exports.validateCustomerInput = async (data) => {
  const customerSchema = Joi.object({
    name: Joi.string().required().max(100),
    email: Joi.string().required().email(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]{8,20}$/),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string(),
      zipCode: Joi.string().required(),
      country: Joi.string().required()
    })
  });

  try {
    const value = await customerSchema.validateAsync(sanitize(data), {
      abortEarly: false,
      stripUnknown: true
    });
    return value;
  } catch (error) {
    throw new AppError(
      `Validation error: ${error.details.map(x => x.message).join(', ')}`,
      400
    );
  }
};