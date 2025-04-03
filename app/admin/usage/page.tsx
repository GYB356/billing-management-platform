import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import CustomerUsageMonitor from '@/components/admin/usage/CustomerUsageMonitor';

export default async function AdminUsagePage() {
  // Get the user's session
  const session = await getServerSession(authOptions);
  
  // Check if user is admin
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }
  
  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Customer Usage Monitoring</h1>
        <p className="mt-2 text-sm text-gray-500">
          Monitor and analyze usage-based billing across all customers.
        </p>
        <div className="mt-6">
          <CustomerUsageMonitor />
        </div>
      </div>
    </div>
  );
} 