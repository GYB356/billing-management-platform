import { prisma } from '@/lib/prisma';

export async function calculateChurnRate() {
  const totalSubscriptions = await prisma.subscription.count();
  const canceledSubscriptions = await prisma.subscription.count({
    where: { status: 'CANCELED' },
  });

  return (canceledSubscriptions / totalSubscriptions) * 100;
}