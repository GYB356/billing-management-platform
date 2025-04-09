import { PrismaClient } from '@prisma/client';
import { createUser, getUserBillingInfo } from '@/lib/db';

const prisma = new PrismaClient();

describe('Database Operations', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  test('should create and retrieve user billing info', async () => {
    const user = await createUser({
      email: 'test@example.com',
      name: 'Test User'
    });

    const billingInfo = await getUserBillingInfo(user.id);
    expect(billingInfo).toBeDefined();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
