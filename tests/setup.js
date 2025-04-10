// Setup file for vitest
import { vi } from 'vitest';

// Mock environment variables
process.env.STRIPE_SECRET_KEY = 'test_stripe_key';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin'
    }
  })
}));

// Mock stripe
vi.mock('stripe', () => {
  return function() {
    return {
      subscriptions: {
        create: vi.fn().mockResolvedValue({ id: 'sub_123' }),
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_123' }),
      }
    };
  };
});

// Mock lib/stripe.ts
vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: 'sub_123' }),
    },
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_123' }),
    }
  }
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      create: vi.fn().mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        planId: 'plan_123',
        organizationId: 'org_123',
        createdAt: new Date(),
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'sub_123',
          status: 'active',
          planId: 'plan_123',
          organizationId: 'org_123',
          createdAt: new Date(),
        }
      ]),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'plan_123',
        name: 'Basic',
        price: 9.99
      }),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'org_123',
        name: 'Test Org'
      }),
    },
  },
}));
