export const PAYMENT_RETRY_STRATEGIES = {
  DEFAULT: {
    maxAttempts: 4,
    intervals: [24, 72, 168], // 1 day, 3 days, 7 days
    requireNewPaymentMethod: false
  },
  AGGRESSIVE: {
    maxAttempts: 6,
    intervals: [3, 24, 72, 168, 336], // 3h, 1d, 3d, 7d, 14d
    requireNewPaymentMethod: true
  },
  CONSERVATIVE: {
    maxAttempts: 3,
    intervals: [72, 168], // 3 days, 7 days
    requireNewPaymentMethod: true
  }
} as const;

export const DEFAULT_DUNNING_CONFIG = {
  steps: [
    {
      daysPastDue: 1,
      actions: ['SEND_NOTIFICATION', 'RETRY_PAYMENT'],
      message: 'Your payment is past due. We will automatically retry the payment.'
    },
    {
      daysPastDue: 3,
      actions: ['SEND_NOTIFICATION', 'RETRY_PAYMENT'],
      message: 'Your payment is 3 days past due. Please update your payment method.'
    },
    {
      daysPastDue: 7,
      actions: ['SEND_NOTIFICATION', 'RETRY_PAYMENT'],
      message: 'Final notice: Your payment is 7 days past due. Service may be suspended.'
    },
    {
      daysPastDue: 14,
      actions: ['SEND_NOTIFICATION'],
      message: 'Your service has been suspended due to non-payment.',
      suspendOnFailure: true
    }
  ],
  maxPaymentAttempts: 4,
  notificationChannels: ['EMAIL', 'IN_APP']
} as const;

export const PAYMENT_FAILURE_RISK_LEVELS = {
  LOW: {
    score: 0,
    codes: ['insufficient_funds', 'expired_card', 'processing_error'],
    strategy: 'DEFAULT'
  },
  MEDIUM: {
    score: 50,
    codes: ['card_declined', 'invalid_number', 'invalid_expiry_year'],
    strategy: 'AGGRESSIVE'
  },
  HIGH: {
    score: 80,
    codes: ['fraudulent', 'stolen_card', 'lost_card'],
    strategy: 'CONSERVATIVE'
  }
} as const;

export const PAYMENT_ATTEMPT_STATUS = {
  SCHEDULED: 'SCHEDULED',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export const DUNNING_ACTION_TYPES = {
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
  RETRY_PAYMENT: 'RETRY_PAYMENT',
  SUSPEND_SERVICE: 'SUSPEND_SERVICE',
  CANCEL_SUBSCRIPTION: 'CANCEL_SUBSCRIPTION'
} as const;