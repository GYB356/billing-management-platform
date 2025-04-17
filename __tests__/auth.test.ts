import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/protected';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

describe('Auth Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no session', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    (getServerSession as jest.Mock).mockResolvedValue(null);
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('should allow access with valid session', async () => {
    const mockSession = {
      user: {
        id: 'user_123',
        email: 'test@example.com',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const { req, res } = createMocks({
      method: 'GET',
    });

    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });

  it('should handle invalid methods', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('should include user data in successful response', async () => {
    const mockSession = {
      user: {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const { req, res } = createMocks({
      method: 'GET',
    });

    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      authenticated: true,
      user: mockSession.user,
    });
  });
}); 