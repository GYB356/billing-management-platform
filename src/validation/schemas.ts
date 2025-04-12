 

export const billingQuestionSchema = z.object({
  body: z.object({
    question: z.string()
      .min(1, 'Question is required')
      .max(500, 'Question is too long')
  })
});

export const metricSchema = z.object({
  body: z.object({
    type: z.enum(['cpu', 'payment', 'churn'], {
      errorMap: () => ({ message: 'Invalid metric type. Must be cpu, payment, or churn' })
    }),
    value: z.number()
      .min(0, 'Value must be non-negative')
      .max(100, 'Value must be less than or equal to 100')
  })
});

export const billingActivitySchema = z.object({
  body: z.object({
    amount: z.number().positive('Amount must be positive'),
    description: z.string().min(1, 'Description is required'),
    status: z.enum(['success', 'failed']),
    customerId: z.string().min(1, 'Customer ID is required')
  })
});