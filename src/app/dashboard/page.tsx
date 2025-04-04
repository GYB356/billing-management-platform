'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { NotificationBanner } from '@/components/NotificationBanner';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { BillingHistory } from '@/components/BillingHistory';
import { ReferralSection } from '@/components/ReferralSection';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in to access your dashboard</h1>
          <a
            href="/auth/signin"
            className="inline-block bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <NotificationBanner />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {session.user?.name}</p>
            <p><span className="font-medium">Email:</span> {session.user?.email}</p>
          </div>
        </div>

        <SubscriptionStatus />
      </div>

      <div className="mt-8">
        <ReferralSection />
      </div>

      <div className="mt-8">
        <BillingHistory />
      </div>
    </div>
  );
} 