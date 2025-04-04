import React, { useState } from 'react';
import axios from 'axios';

const NotificationManagement = () => {
  const [userId, setUserId] = useState('');
  const [channel, setChannel] = useState('email');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await axios.post('/api/admin/notifications/send', {
        userId,
        channel,
        message,
      });

      if (response.data.success) {
        setSuccess('Notification sent successfully!');
      }
    } catch (err) {
      setError('Failed to send notification.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Notification Management</h1>
      <form onSubmit={handleSendNotification}>
        <div>
          <label>User ID:</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Channel:</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="in-app">In-App</option>
          </select>
        </div>
        <div>
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          ></textarea>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Notification'}
        </button>
      </form>
      {success && <p style={{ color: 'green' }}>{success}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default NotificationManagement;