'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function TwoFactorSettings() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnable2FA = async () => {
    try {
      setLoading(true);
      setError(null);
      router.push('/auth/2fa-setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disable 2FA');
      }

      await update();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/2fa/backup-codes', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate backup codes');
      }

      const data = await response.json();
      // Show backup codes in a modal or alert
      alert('New backup codes:\n\n' + data.backupCodes.join('\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {session?.user?.twoFactorEnabled ? (
                <Shield className="h-5 w-5 text-green-500" />
              ) : (
                <ShieldOff className="h-5 w-5 text-gray-400" />
              )}
              <p className="font-medium">
                {session?.user?.twoFactorEnabled
                  ? 'Two-factor authentication is enabled'
                  : 'Two-factor authentication is disabled'}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              {session?.user?.twoFactorEnabled
                ? 'Your account is protected with 2FA'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>

          {session?.user?.twoFactorEnabled ? (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleRegenerateBackupCodes}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  'Regenerate Backup Codes'
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disabling...
                  </>
                ) : (
                  'Disable 2FA'
                )}
              </Button>
            </div>
          ) : (
            <Button onClick={handleEnable2FA} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                'Enable 2FA'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 