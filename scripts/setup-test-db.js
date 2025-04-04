const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function setupTestDatabase() {
  try {
    console.log('Setting up test database...');

    // Create test admin user
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        name: 'Test Admin',
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: new Date(),
      },
    });

    // Create test regular user
    const user = await prisma.user.upsert({
      where: { email: 'user@test.com' },
      update: {},
      create: {
        email: 'user@test.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'USER',
        emailVerified: new Date(),
      },
    });

    // Create test security events
    const securityEvents = [
      {
        userId: admin.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        eventType: 'LOGIN_SUCCESS',
        details: { success: true },
        severity: 'LOW',
      },
      {
        userId: user.id,
        ipAddress: '127.0.0.2',
        userAgent: 'Test Browser',
        eventType: 'LOGIN_FAILURE',
        details: { attempt: 1 },
        severity: 'MEDIUM',
      },
      {
        ipAddress: '127.0.0.3',
        userAgent: 'Test Browser',
        eventType: 'SUSPICIOUS_ACTIVITY',
        details: { reason: 'Multiple failed attempts' },
        severity: 'HIGH',
      },
    ];

    for (const event of securityEvents) {
      await prisma.securityEvent.create({
        data: event,
      });
    }

    console.log('Test database setup completed successfully');
    console.log('Test users created:');
    console.log('Admin:', admin.email);
    console.log('User:', user.email);
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestDatabase(); 