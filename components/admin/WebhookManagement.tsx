import React, { useEffect, useState } from 'react';
import axios from 'axios';

const WebhookManagement = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWebhooks = async () => {
      try {
        const response = await axios.get('/api/admin/webhooks');
        setWebhooks(response.data);
      } catch (err) {
        setError('Failed to load webhooks.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchWebhooks();
  }, []);

  if (loading) return <p>Loading webhooks...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Webhook Management</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>URL</th>
            <th>Event Types</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((webhook) => (
            <tr key={webhook.id}>
              <td>{webhook.id}</td>
              <td>{webhook.url}</td>
              <td>{webhook.eventTypes.join(', ')}</td>
              <td>
                <button>Edit</button>
                <button>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WebhookManagement;