import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked AI response' } }]
          })
        }
      }
    }))
  };
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mocked-id' })
  })
}));

beforeEach(() => {
  jest.clearAllMocks();
});

process.env = {
  ...process.env,
  OPENAI_API_KEY: 'test-api-key',
  SMTP_HOST: 'smtp.test.com',
  SMTP_PORT: '587',
  SMTP_USER: 'test-user',
  SMTP_PASSWORD: 'test-password',
  EMAIL_FROM: 'test@example.com',
  ADMIN_EMAIL: 'admin@example.com',
  JWT_SECRET: 'test-jwt-secret'
}; 