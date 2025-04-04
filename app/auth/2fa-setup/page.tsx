'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { BackupCodesModal } from '@/components/auth/backup-codes-modal';

export default function TwoFactorSetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    const setup2FA = async () => {
      try {
        const response = await fetch('/api/auth/2fa/setup');
        if (!response.ok) {
          throw new Error('Failed to setup 2FA');
        }
        const data = await response.json();
        setQrCode(data.qrCode);
        setSecret(data.secret);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    setup2FA();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setVerifying(true);
      setError(null);

      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        throw new Error('Invalid verification code');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setVerifying(false);
    }
  };

  const handleBackupCodesClose = () => {
    setBackupCodes(null);
    router.push('/settings');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (backupCodes) {
    return <BackupCodesModal backupCodes={backupCodes} onClose={handleBackupCodesClose} />;
  }

  return (
    <div className="container max-w-lg mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app and enter the verification code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {qrCode && (
            <div className="flex justify-center">
              <Image
                src={qrCode}
                alt="2FA QR Code"
                width={200}
                height={200}
                className="rounded-lg"
              />
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                pattern="[0-9]{6}"
                required
              />
            </div>

            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/settings')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={verifying}>
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
