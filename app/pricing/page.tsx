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

export default async function PricingPage() {
  const [plans, features] = await Promise.all([getActivePlans(), getFeatures()]);

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:flex-col sm:align-center">
          <h1 className="text-5xl font-extrabold text-gray-900 sm:text-center">Pricing Plans</h1>
          <p className="mt-5 text-xl text-gray-500 sm:text-center">
            Start building today with the right plan for your needs.
          </p>
          <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 w-full">
            <PricingTable
              plans={plans}
              features={features}
              showAnnualToggle={true}
              currency="USD"
              onSelectPlan={(planId) => {
                // This will be handled by client-side JS
                console.log(`Selected plan: ${planId}`);
              }}
            />
          </div>
        </div>
        
        <div className="mt-16 border-t border-gray-200 pt-16">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-center">Frequently asked questions</h2>
          <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-medium text-gray-900">How do your trial periods work?</h3>
              <p className="mt-2 text-base text-gray-500">
                Our trial periods allow you to test the full capabilities of our platform risk-free. 
                You can cancel anytime during the trial period without being charged.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Can I change plans later?</h3>
              <p className="mt-2 text-base text-gray-500">
                Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately, 
                while downgrades will take effect at the end of your current billing cycle.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">What payment methods do you accept?</h3>
              <p className="mt-2 text-base text-gray-500">
                We accept all major credit cards, debit cards, and PayPal. For annual Enterprise plans, 
                we can also accommodate wire transfers and invoicing.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">How does billing work?</h3>
              <p className="mt-2 text-base text-gray-500">
                You'll be billed at the start of each billing cycle. For monthly plans, that's every 30 days, 
                and for annual plans, that's once per year. All plans include automatic renewals, which you can disable in your account settings.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Do you offer refunds?</h3>
              <p className="mt-2 text-base text-gray-500">
                We offer a 14-day money-back guarantee for all plans if you're not satisfied with our service. 
                For any issues or refund requests, please contact our support team.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Do you offer discounts?</h3>
              <p className="mt-2 text-base text-gray-500">
                Yes, we offer discounts for annual subscriptions, educational institutions, and non-profit organizations. 
                Contact our sales team for more information.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-16 sm:align-center sm:flex sm:flex-col">
          <div className="rounded-2xl bg-indigo-50 py-10 px-6 sm:px-12">
            <div className="lg:grid lg:grid-cols-3 lg:gap-8">
              <div className="lg:col-span-2">
                <h3 className="text-xl font-medium text-indigo-900">Custom pricing for enterprise</h3>
                <p className="mt-4 text-lg text-indigo-600">
                  Need a custom solution for your organization? Our enterprise plans offer additional features, 
                  dedicated support, and customizable options to meet your specific requirements.
                </p>
              </div>
              <div className="mt-8 flex lg:mt-0 lg:justify-end">
                <div className="flex-shrink-0 self-center">
                  <a
                    href="/contact"
                    className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Contact Sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 