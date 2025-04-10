'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  country: string;
  state?: string;
  city?: string;
}

interface TaxExemption {
  id: string;
  customerId: string;
  taxRateId: string;
  startDate: string;
  endDate?: string;
  reason: string;
  customer: Customer;
  taxRate: TaxRate;
}

export default function TaxExemptionsPage() {
  const [taxExemptions, setTaxExemptions] = useState<TaxExemption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExemption, setEditingExemption] = useState<TaxExemption | null>(
    null
  );
  const [formData, setFormData] = useState({
    customerId: '',
    taxRateId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [exemptionsRes, customersRes, taxRatesRes] = await Promise.all([
        fetch('/api/tax-exemptions'),
        fetch('/api/customers'),
        fetch('/api/tax-rates'),
      ]);

      if (!exemptionsRes.ok) throw new Error('Failed to fetch tax exemptions');
      if (!customersRes.ok) throw new Error('Failed to fetch customers');
      if (!taxRatesRes.ok) throw new Error('Failed to fetch tax rates');

      const [exemptionsData, customersData, taxRatesData] = await Promise.all([
        exemptionsRes.json(),
        customersRes.json(),
        taxRatesRes.json(),
      ]);

      setTaxExemptions(exemptionsData);
      setCustomers(customersData);
      setTaxRates(taxRatesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingExemption
        ? `/api/tax-exemptions/${editingExemption.id}`
        : '/api/tax-exemptions';
      const method = editingExemption ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save tax exemption');

      setIsDialogOpen(false);
      fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving tax exemption:', error);
    }
  };

  const handleEdit = (exemption: TaxExemption) => {
    setEditingExemption(exemption);
    setFormData({
      customerId: exemption.customerId,
      taxRateId: exemption.taxRateId,
      startDate: exemption.startDate,
      endDate: exemption.endDate || '',
      reason: exemption.reason,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax exemption?')) return;

    try {
      const response = await fetch(`/api/tax-exemptions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete tax exemption');

      fetchData();
    } catch (error) {
      console.error('Error deleting tax exemption:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      taxRateId: '',
      startDate: '',
      endDate: '',
      reason: '',
    });
    setEditingExemption(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tax Exemptions</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tax Exemption
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingExemption ? 'Edit Tax Exemption' : 'Add Tax Exemption'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer</label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, customerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tax Rate</label>
                <Select
                  value={formData.taxRateId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, taxRateId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tax rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxRates.map((taxRate) => (
                      <SelectItem key={taxRate.id} value={taxRate.id}>
                        {taxRate.name} ({taxRate.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date (Optional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingExemption ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax Exemptions List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Tax Rate</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxExemptions.map((exemption) => (
                <TableRow key={exemption.id}>
                  <TableCell>{exemption.customer.name}</TableCell>
                  <TableCell>
                    {exemption.taxRate.name} ({exemption.taxRate.rate}%)
                  </TableCell>
                  <TableCell>
                    {new Date(exemption.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {exemption.endDate
                      ? new Date(exemption.endDate).toLocaleDateString()
                      : 'No end date'}
                  </TableCell>
                  <TableCell>{exemption.reason}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(exemption)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(exemption.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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