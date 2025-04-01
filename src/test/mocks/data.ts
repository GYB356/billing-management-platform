export const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  subscription_status: 'active',
  subscription: {
    id: 'sub_1',
    planName: 'Pro',
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastPaymentStatus: 'succeeded',
    stripeSubscriptionId: 'sub_1',
  },
};

export const mockSubscription = {
  id: 'sub_1',
  planName: 'Pro',
  price: 29.99,
  status: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  lastPaymentStatus: 'succeeded',
  stripeSubscriptionId: 'sub_1',
};

export const mockInvoices = [
  {
    id: 'in_1',
    amount: 2999,
    status: 'paid',
    created: new Date().toISOString(),
    pdfUrl: 'https://example.com/invoice.pdf',
  },
  {
    id: 'in_2',
    amount: 2999,
    status: 'paid',
    created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    pdfUrl: 'https://example.com/invoice.pdf',
  },
]; 