import { useQuery } from 'react-query';

interface Subscription {
  status: string;
}

const SubscriptionStatus = ({ userId }: { userId: string }) => {
  const { isLoading, error, data } = useQuery<Subscription, Error>(
    ['subscription', userId],
    async () => {
      const response = await fetch('/api/subscriptions/current');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }
      return response.json();
    },
    {
      enabled: !!userId,
    }
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!data || !data.status) {
    return <div>No active subscription</div>;
  }

  return <div>Status: {data.status}</div>;
};

export default SubscriptionStatus;