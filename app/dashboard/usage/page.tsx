import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import UsageDashboard from '@/components/dashboard/UsageDashboard';

export default async function UsagePage() {
  // Get the user's session
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }
  
  // Get the user's active subscription
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      user: {
        email: session.user.email,
      },
    },
    include: {
      organization: {
        include: {
          subscriptions: {
            where: {
              status: 'ACTIVE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  });

  const subscription = userOrg?.organization.subscriptions[0];

  if (!subscription) {
    // No active subscription found
    return (
      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Usage</h1>
          <div className="mt-6 bg-white shadow overflow-hidden rounded-lg p-6">
            <p className="text-gray-500">
              You don't have an active subscription. Please subscribe to a plan to view usage data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Usage</h1>
        <div className="mt-6 bg-white shadow overflow-hidden rounded-lg p-6">
          <UsageDashboard subscriptionId={subscription.id} />
        </div>
      </div>
    </div>
  );
} 