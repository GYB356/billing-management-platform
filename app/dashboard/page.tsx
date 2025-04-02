'use client';

import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Welcome, {session?.user?.name || 'User'}!</h1>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Example Dashboard Cards */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800">Manage Users</h2>
          <p className="text-sm text-gray-600 mt-2">View and manage user accounts.</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800">Subscriptions</h2>
          <p className="text-sm text-gray-600 mt-2">Track and manage subscriptions.</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800">Billing</h2>
          <p className="text-sm text-gray-600 mt-2">View and process invoices.</p>
        </div>
      </div>
    </div>
  );
}