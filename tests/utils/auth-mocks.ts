import { Session } from 'next-auth';

export const mockSession = (userRole = 'user'): Session => ({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: userRole,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});
