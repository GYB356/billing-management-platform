import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

interface AccountInfo {
  name: string;
  email: string;
  company: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export function AccountSettings() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        const response = await fetch('/api/account');
        if (!response.ok) throw new Error('Failed to fetch account information');
        const data = await response.json();
        setAccountInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountInfo) return;

    setSaving(true);
    try {
      const response = await fetch('/api/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountInfo),
      });

      if (!response.ok) throw new Error('Failed to update account information');

      toast({
        title: 'Success',
        description: 'Account information updated successfully.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account information');
      toast({
        title: 'Error',
        description: 'Failed to update account information.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading account settings...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!accountInfo) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Account Information</h3>
        
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={accountInfo.name}
                onChange={(e) => setAccountInfo({ ...accountInfo, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={accountInfo.email}
                onChange={(e) => setAccountInfo({ ...accountInfo, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={accountInfo.company}
                onChange={(e) => setAccountInfo({ ...accountInfo, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={accountInfo.phone}
                onChange={(e) => setAccountInfo({ ...accountInfo, phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Billing Address</h3>
        
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="address1">Address Line 1</Label>
            <Input
              id="address1"
              value={accountInfo.address.line1}
              onChange={(e) => setAccountInfo({
                ...accountInfo,
                address: { ...accountInfo.address, line1: e.target.value }
              })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address2">Address Line 2</Label>
            <Input
              id="address2"
              value={accountInfo.address.line2 || ''}
              onChange={(e) => setAccountInfo({
                ...accountInfo,
                address: { ...accountInfo.address, line2: e.target.value }
              })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={accountInfo.address.city}
                onChange={(e) => setAccountInfo({
                  ...accountInfo,
                  address: { ...accountInfo.address, city: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={accountInfo.address.state}
                onChange={(e) => setAccountInfo({
                  ...accountInfo,
                  address: { ...accountInfo.address, state: e.target.value }
                })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={accountInfo.address.postalCode}
                onChange={(e) => setAccountInfo({
                  ...accountInfo,
                  address: { ...accountInfo.address, postalCode: e.target.value }
                })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={accountInfo.address.country}
                onChange={(e) => setAccountInfo({
                  ...accountInfo,
                  address: { ...accountInfo.address, country: e.target.value }
                })}
                required
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}