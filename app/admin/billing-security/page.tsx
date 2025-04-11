import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { ActivityLogsManager } from '@/components/admin/ActivityLogsManager';
import { TeamPermissionsManager } from '@/components/admin/TeamPermissionsManager';

export const metadata: Metadata = {
  title: 'Billing Security & Permissions | Admin Dashboard',
  description: 'Manage team permissions and monitor billing activities',
};

export default async function BillingSecurityPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Billing Security & Permissions</h1>
        <p className="text-gray-500">
          Manage team access controls and monitor billing activities
        </p>
      </div>

      <div className="grid gap-8">
        <TeamPermissionsManager />
        <ActivityLogsManager />
      </div>
    </div>
  );
}