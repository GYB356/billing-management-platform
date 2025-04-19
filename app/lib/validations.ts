import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const customerSchema = z.object({
  companyName: z.string().optional(),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z
    .object({
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      postalCode: z.string().min(1, 'Postal code is required'),
      country: z.string().min(1, 'Country is required'),
    })
    .optional(),
});

export const billingInfoSchema = z.object({
  type: z.enum(['credit_card', 'bank_account'], {
    required_error: 'Please select a payment method',
  }),
  cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card number'),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Invalid expiry date (MM/YY)'),
  cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
  isDefault: z.boolean().default(false),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  dueDate: z.date({
    required_error: 'Due date is required',
  }),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        quantity: z.number().min(1, 'Quantity must be at least 1'),
        unitPrice: z.number().min(0, 'Unit price must be positive'),
      })
    )
    .min(1, 'At least one item is required'),
  currency: z.string().default('USD'),
});

export const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  description: z.string().min(1, 'Plan description is required'),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().default('USD'),
  interval: z.enum(['month', 'year'], {
    required_error: 'Please select a billing interval',
  }),
  features: z.array(z.string()).min(1, 'At least one feature is required'),
  isActive: z.boolean().default(true),
});

export const subscriptionSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  planId: z.string().min(1, 'Plan is required'),
  status: z.enum(['active', 'canceled', 'suspended'], {
    required_error: 'Please select a status',
  }),
  currentPeriodStart: z.date({
    required_error: 'Start date is required',
  }),
  currentPeriodEnd: z.date({
    required_error: 'End date is required',
  }),
});

export const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['user', 'admin']).default('user'),
});

export const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

export const paymentMethodSchema = z.object({
  type: z.enum(['credit_card', 'bank_account'], {
    required_error: 'Please select a payment method type',
  }),
  cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card number'),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Invalid expiry date (MM/YY)'),
  cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
  name: z.string().min(1, 'Cardholder name is required'),
  isDefault: z.boolean().default(false),
});

export const settingsSchema = z.object({
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    marketing: z.boolean().default(false),
  }),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().min(2, 'Language code must be at least 2 characters'),
  timezone: z.string().min(1, 'Timezone is required'),
}); 