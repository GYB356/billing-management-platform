require('dotenv').config({ path: '.env.test' });

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-id' }),
    },
  })),
}));

// Mock NextAuth
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn().mockResolvedValue({
    sub: 'test-user-id',
    role: 'ADMIN',
  }),
}));

// Global test timeout
jest.setTimeout(10000);

// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { setGlobalDispatcher, MockAgent } from 'undici';

// Polyfill for encoding which isn't present in JSDOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock fetch using undici
const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200,
  })
);

// Mock Request
class MockRequest {
  constructor(input, init = {}) {
    this.url = input;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }
}
global.Request = MockRequest;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(),
  },
}));

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn(() => []),
    },
    securityAlert: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
    $on: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(() => null),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
}); 