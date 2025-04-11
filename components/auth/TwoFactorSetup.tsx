import React, { useState } from 'react';
import axios from 'axios';

const TwoFactorSetup = () => {
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleEnable2FA = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/auth/2fa/enable');
      setQrCode(response.data.qrCode);
    } catch (err) {
      setError('Failed to enable 2FA.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Enable Two-Factor Authentication</h1>
      <button onClick={handleEnable2FA} disabled={loading}>
        {loading ? 'Enabling...' : 'Enable 2FA'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {qrCode && (
        <div>
          <h2>Scan this QR Code with your Authenticator App</h2>
          <img src={qrCode} alt="QR Code for 2FA" />
        </div>
      )}
    </div>
  );
};

export default TwoFactorSetup;