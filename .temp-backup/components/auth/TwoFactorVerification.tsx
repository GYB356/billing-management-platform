import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface TwoFactorVerificationProps {
  onVerify: (success: boolean) => void;
  userId: string;
}

export default function TwoFactorVerification({ onVerify, userId }: TwoFactorVerificationProps) {
  const [method, setMethod] = useState<'totp' | 'email' | 'backup'>('totp');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const verify = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          method,
          token
        })
      });

      const data = await res.json();
      if (data.success) {
        onVerify(true);
      } else {
        setError('Invalid code');
        onVerify(false);
      }
    } catch (err) {
      setError('Verification failed');
      onVerify(false);
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmailCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      await fetch('/api/auth/2fa?action=email');
      setMethod('email');
    } catch (err) {
      setError('Failed to send email code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Verify Your Identity</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex gap-2">
          <Button
            onClick={() => setMethod('totp')}
            variant={method === 'totp' ? 'default' : 'outline'}
          >
            Use Authenticator
          </Button>
          <Button
            onClick={sendEmailCode}
            variant={method === 'email' ? 'default' : 'outline'}
          >
            Email Code
          </Button>
          <Button
            onClick={() => setMethod('backup')}
            variant={method === 'backup' ? 'default' : 'outline'}
          >
            Use Backup Code
          </Button>
        </div>

        <div>
          {method === 'totp' && (
            <p className="text-sm text-gray-600">
              Enter the code from your authenticator app
            </p>
          )}
          {method === 'email' && (
            <p className="text-sm text-gray-600">
              Enter the code sent to your email address
            </p>
          )}
          {method === 'backup' && (
            <p className="text-sm text-gray-600">
              Enter one of your backup recovery codes
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <Input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter code"
            className="w-32"
            disabled={isLoading}
          />
          <Button
            onClick={verify}
            disabled={!token || isLoading}
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </div>
    </div>
  );
}