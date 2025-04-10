import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../app/api/subscriptions/route';
import { prisma } from '@/lib/prisma';
import { mockSession } from '../utils/auth-mocks';

// Mock stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        create: vi.fn().mockResolvedValue({ id: 'sub_123' }),
      },
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_123' }),
      }
    }))
  };
});

// Mock getServerSession
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession('admin'))),
}));

// Mock lib/stripe.ts to prevent the error
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

describe('Subscription API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a subscription successfully', async () => {
    const req = new NextRequest('http://localhost:3000/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'plan_123',
        organizationId: 'org_123',
      }),
    });

    const response = await POST(req);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.subscription).toBeDefined();
  });
  
  it('should get subscriptions', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/subscriptions?organizationId=org_123', 
      { method: 'GET' }
    );
    
    const response = await GET(req);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});
