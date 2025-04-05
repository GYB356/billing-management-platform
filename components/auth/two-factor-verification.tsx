'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface TwoFactorVerificationProps {
  onVerify: (code: string) => Promise<void>;
  onBackupCode: (code: string) => Promise<void>;
  email: string;
}

export function TwoFactorVerification({
  onVerify,
  onBackupCode,
  email,
}: TwoFactorVerificationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      if (isBackupCode) {
        await onBackupCode(code);
      } else {
        await onVerify(code);
      }
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
          Enter the verification code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">
              {isBackupCode ? 'Backup Code' : 'Verification Code'}
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={isBackupCode ? 'Enter backup code' : 'Enter 6-digit code'}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Button type="submit" disabled={loading || !code}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBackupCode(!isBackupCode)}
              disabled={loading}
            >
              {isBackupCode
                ? 'Use authenticator app instead'
                : 'Use backup code instead'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 