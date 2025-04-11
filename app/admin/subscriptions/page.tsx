'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import SubscriptionAnalytics from '@/components/admin/subscriptions/SubscriptionAnalytics';
import SubscriptionFilters from '@/components/admin/subscriptions/SubscriptionFilters';
import SubscriptionTable from '@/components/admin/subscriptions/SubscriptionTable';

async function getSubscriptions(searchParams: URLSearchParams) {
  const response = await fetch(`/api/admin/subscriptions?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }
  return response.json();
}

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    async function fetchSubscriptions() {
      const response = await fetch('/api/admin/subscriptions');
      const data = await response.json();
      setSubscriptions(data);
    }
    fetchSubscriptions();
  }, []);

  const updateSubscription = async (id, status) => {
    await fetch(`/api/admin/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    // Refresh subscriptions
    fetchSubscriptions();
  };

  return (
    <div>
      <h1>Subscription Management</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id}>
              <td>{sub.id}</td>
              <td>{sub.userId}</td>
              <td>{sub.status}</td>
              <td>
                <button onClick={() => updateSubscription(sub.id, 'ACTIVE')}>Activate</button>
                <button onClick={() => updateSubscription(sub.id, 'CANCELED')}>Cancel</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}