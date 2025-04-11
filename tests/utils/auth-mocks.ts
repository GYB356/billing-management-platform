import { vi } from 'vitest';

export const mockSession = (userRole = 'user') => ({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: userRole,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

export const mockRequest = () => ({
  headers: {
    get: vi.fn((name) => name === 'authorization' ? 'Bearer test-token' : null)
  }
});
