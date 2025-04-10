import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import TwoFactorVerification from './TwoFactorVerification';

interface LoginFlowProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function LoginFlow({ onSuccess, onError }: LoginFlowProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password
      });

      if (result?.error === 'requires_2fa') {
        setRequires2FA(true);
        setUserId(result.userId as string);
      } else if (result?.error) {
        setError('Invalid email or password');
        onError?.('Invalid email or password');
      } else if (result?.ok) {
        onSuccess?.();
      }
    } catch (err) {
      setError('An error occurred during login');
      onError?.('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerification = (success: boolean) => {
    if (success) {
      onSuccess?.();
    } else {
      setError('2FA verification failed');
      onError?.('2FA verification failed');
    }
  };

  if (requires2FA && userId) {
    return (
      <TwoFactorVerification
        userId={userId}
        onVerify={handle2FAVerification}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Sign In</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
} 