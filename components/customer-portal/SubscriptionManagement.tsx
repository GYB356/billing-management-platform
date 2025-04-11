import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await axios.get('/api/customer/subscriptions');
        setSubscriptions(response.data);
      } catch (err) {
        setError('Failed to load subscriptions.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  if (loading) return <p>Loading subscriptions...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Your Subscriptions</h1>
      <ul>
        {subscriptions.map((sub) => (
          <li key={sub.id}>
            <h2>{sub.plan.name}</h2>
            <p>Status: {sub.status}</p>
            <button>Cancel</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SubscriptionManagement;