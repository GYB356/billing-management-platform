import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import QRCode from 'qrcode.react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export default function TwoFactorSettings() {
  const { data: session } = useSession();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<'initial' | 'qr' | 'verify'>('initial');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch current 2FA status
    fetch('/api/auth/2fa?action=status')
      .then(res => res.json())
      .then(data => setIs2FAEnabled(data.required))
      .catch(err => setError('Failed to fetch 2FA status'));
  }, []);

  const startSetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa?action=generate');
      const data = await res.json();
      setSecret(data.secret);
      setQrCodeUrl(data.qrCodeUrl);
      setSetupStep('qr');
    } catch (err) {
      setError('Failed to generate 2FA secret');
    }
  };

  const verifyAndEnable = async () => {
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          secret,
          token
        })
      });

      const data = await res.json();
      if (data.success) {
        setIs2FAEnabled(true);
        setBackupCodes(data.backupCodes || []);
        setSetupStep('initial');
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError('Failed to enable 2FA');
    }
  };

  const disable2FA = async () => {
    try {
      await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' })
      });
      setIs2FAEnabled(false);
    } catch (err) {
      setError('Failed to disable 2FA');
    }
  };

  if (!session) {
    return <div>Please sign in to manage 2FA settings.</div>;
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Two-Factor Authentication</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {is2FAEnabled ? (
        <div>
          <p className="mb-4">Two-factor authentication is enabled.</p>
          <Button
            onClick={disable2FA}
            variant="destructive"
          >
            Disable 2FA
          </Button>
        </div>
      ) : (
        <div>
          {setupStep === 'initial' && (
            <div>
              <p className="mb-4">
                Two-factor authentication adds an extra layer of security to your account.
                When enabled, you'll need to enter a verification code in addition to your password.
              </p>
              <Button onClick={startSetup}>
                Set up 2FA
              </Button>
            </div>
          )}

          {setupStep === 'qr' && (
            <div>
              <p className="mb-4">
                1. Scan this QR code with your authenticator app (like Google Authenticator or Authy)
              </p>
              <div className="mb-6">
                <QRCode value={qrCodeUrl} size={200} />
              </div>
              <p className="mb-2">
                2. Enter the verification code from your authenticator app:
              </p>
              <div className="flex gap-4">
                <Input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter code"
                  className="w-32"
                />
                <Button onClick={verifyAndEnable}>
                  Verify and Enable
                </Button>
              </div>
            </div>
          )}

          {backupCodes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Backup Codes</h3>
              <p className="mb-2 text-sm text-gray-600">
                Save these backup codes in a secure place. You can use them to access your account if you lose your authenticator device.
              </p>
              <div className="bg-gray-100 p-4 rounded font-mono text-sm">
                {backupCodes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 