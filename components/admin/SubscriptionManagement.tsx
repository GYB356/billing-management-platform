import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await axios.get('/api/admin/subscriptions');
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
      <h1>Subscription Management</h1>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id}>
              <td>{sub.user?.email || 'N/A'}</td>
              <td>{sub.plan?.name || 'N/A'}</td>
              <td>{sub.status}</td>
              <td>
                <button>Cancel</button>
                <button>Pause</button>
                <button>Resume</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SubscriptionManagement;