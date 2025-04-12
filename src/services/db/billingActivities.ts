import { prisma } from '../../lib/prisma';

export async function getWeeklyBillingActivities() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return await prisma.billingActivity.findMany({
    where: {
      timestamp: {
        gte: weekAgo
      }
    },
    orderBy: {
      timestamp: 'desc'
    }
  });
}

export async function createBillingActivity(data: {
  amount: number;
  description: string;
  status: string;
  customerId: string;
}) {
  return await prisma.billingActivity.create({
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

export async function getCustomerBillingActivities(customerId: string) {
  return await prisma.billingActivity.findMany({
    where: {
      customerId
    },
    orderBy: {
      timestamp: 'desc'
    }
  });
} 