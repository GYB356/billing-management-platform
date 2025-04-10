import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Basic Test', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should mock prisma correctly', async () => {
    const subscription = await prisma.subscription.create({
      data: {
        planId: 'plan_123',
        organizationId: 'org_123'
      }
    });
    
    expect(subscription).toBeDefined();
    expect(subscription.id).toBe('sub_123');
  });
});
