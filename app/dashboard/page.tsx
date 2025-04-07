'use client';

import { Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import DashboardOverview from './components/DashboardOverview';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-40" />
    </div>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-500">Please sign in to access your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Welcome, {session.user?.name || 'User'}!
      </h1>
      <Suspense fallback={<LoadingState />}>
        <DashboardOverview />
      </Suspense>
    </div>
  );
}