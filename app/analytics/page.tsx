import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import AdvancedDashboard from '@/components/analytics/AdvancedDashboard';

export const metadata = {
  title: 'Analytics Dashboard | Billing Management Platform',
  description: 'Comprehensive analytics and insights for your billing operations'
};

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Get user's organization
  const userOrganization = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      organizationId: true,
      role: true,
    }
  });

  if (!userOrganization) {
    redirect('/dashboard');
  }

  // Check permissions
  if (!['ADMIN', 'OWNER', 'BILLING_ADMIN'].includes(userOrganization.role)) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto py-6">
      <AdvancedDashboard organizationId={userOrganization.organizationId} />
    </div>
  );
}