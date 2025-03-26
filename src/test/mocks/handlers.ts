import { rest } from 'msw';
import { mockUser, mockSubscription, mockInvoices } from './data';

export const handlers = [
  // Auth handlers
  rest.post('/api/auth/signin', async (req, res, ctx) => {
    const { email, password } = await req.json();
    if (email === 'test@example.com' && password === 'password123') {
      return res(
        ctx.status(200),
        ctx.json({
          user: mockUser,
          token: 'mock-token',
        })
      );
    }
    return res(
      ctx.status(401),
      ctx.json({ error: 'Invalid credentials' })
    );
  }),

  rest.get('/api/auth/session', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    );
  }),

  // Subscription handlers
  rest.post('/api/subscription/create', async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        subscription: mockSubscription,
        clientSecret: 'mock-client-secret',
      })
    );
  }),

  rest.post('/api/subscription/cancel', async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        message: 'Subscription cancelled successfully',
        subscription: {
          ...mockSubscription,
          status: 'cancelled',
        },
      })
    );
  }),

  // Billing history handlers
  rest.get('/api/billing/history', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        invoices: mockInvoices,
      })
    );
  }),

  // Admin handlers
  rest.get('/api/admin/dashboard', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        totalRevenue: 1000,
        activeSubscriptions: 5,
        totalUsers: 10,
        newUsersThisMonth: 2,
      })
    );
  }),

  rest.get('/api/admin/users', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        users: [mockUser],
      })
    );
  }),
]; 