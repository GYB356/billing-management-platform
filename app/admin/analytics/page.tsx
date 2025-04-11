import { useEffect, useState } from 'react';

export default function Analytics() {
  const [analytics, setAnalytics] = useState({ revenue: 0, userCount: 0, subscriptionCount: 0 });

  useEffect(() => {
    async function fetchAnalytics() {
      const response = await fetch('/api/admin/analytics');
      const data = await response.json();
      setAnalytics(data);
    }
    fetchAnalytics();
  }, []);

  return (
    <div>
      <h1>Analytics</h1>
      <p>Total Revenue: ${analytics.revenue}</p>
      <p>Total Users: {analytics.userCount}</p>
      <p>Total Subscriptions: {analytics.subscriptionCount}</p>
    </div>
  );
}