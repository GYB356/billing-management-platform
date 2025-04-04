import PricingTable from '@/components/pricing/PricingTable';
import prisma from '@/lib/prisma';

export const metadata = {
  title: 'Pricing Plans',
  description: 'Choose the right plan for your needs',
};

export const revalidate = 3600; // Revalidate at most once per hour

async function getActivePlans() {
  const plans = await prisma.pricingPlan.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    include: {
      tiers: true,
      planFeatures: {
        include: {
          feature: true,
        },
      },
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  return plans;
}

async function getFeatures() {
  const features = await prisma.planFeature.findMany({
    orderBy: [
      {
        isHighlighted: 'desc',
      },
      {
        name: 'asc',
      },
    ],
  });

  return features;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-bold">Pricing Page</h1>
    </div>
  );
}