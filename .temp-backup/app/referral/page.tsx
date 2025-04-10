'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/ui/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Copy, Plus } from 'lucide-react';

interface ReferralCode {
  id: string;
  code: string;
  discountAmount: number;
  discountType: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
  referrals: Array<{
    status: string;
    createdAt: string;
    referredUser: {
      name: string | null;
      email: string;
    };
  }>;
}

export default function ReferralDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState({
    discountAmount: 10,
    discountType: 'percentage',
    maxUses: 100,
  });

  useEffect(() => {
    loadReferralCodes();
  }, []);

  const loadReferralCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/referral/code');
      if (!response.ok) {
        throw new Error('Failed to load referral codes');
      }
      const data = await response.json();
      setReferralCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    try {
      setCreating(true);
      setError(null);
      const response = await fetch('/api/referral/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCode),
      });

      if (!response.ok) {
        throw new Error('Failed to create referral code');
      }

      await loadReferralCodes();
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create referral code');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Referral Program</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Referral Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Referral Code</DialogTitle>
              <DialogDescription>
                Create a new referral code with custom discount settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="discountAmount">Discount Amount</Label>
                <Input
                  id="discountAmount"
                  type="number"
                  value={newCode.discountAmount}
                  onChange={(e) =>
                    setNewCode({ ...newCode, discountAmount: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Maximum Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  value={newCode.maxUses}
                  onChange={(e) =>
                    setNewCode({ ...newCode, maxUses: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateCode}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Code'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Referrals</CardTitle>
            <CardDescription>Number of successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {referralCodes.reduce(
                (sum, code) =>
                  sum + code.referrals.filter((r) => r.status === 'completed').length,
                0
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Codes</CardTitle>
            <CardDescription>Number of active referral codes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {referralCodes.filter(
                (code) => !code.expiresAt || new Date(code.expiresAt) > new Date()
              ).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate</CardTitle>
            <CardDescription>Percentage of successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {referralCodes.reduce((sum, code) => sum + code.referrals.length, 0) > 0
                ? Math.round(
                    (referralCodes.reduce(
                      (sum, code) =>
                        sum +
                        code.referrals.filter((r) => r.status === 'completed').length,
                      0
                    ) /
                      referralCodes.reduce(
                        (sum, code) => sum + code.referrals.length,
                        0
                      )) *
                      100
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral Codes</CardTitle>
          <CardDescription>Manage your referral codes and track their usage</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referralCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono">{code.code}</TableCell>
                  <TableCell>
                    {code.discountAmount}
                    {code.discountType === 'percentage' ? '%' : '$'}
                  </TableCell>
                  <TableCell>
                    {code.usedCount} / {code.maxUses || '∞'}
                  </TableCell>
                  <TableCell>{format(new Date(code.createdAt), 'PP')}</TableCell>
                  <TableCell>
                    {code.expiresAt
                      ? format(new Date(code.expiresAt), 'PP')
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(code.code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 