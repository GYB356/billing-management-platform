'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DownloadIcon, FilterIcon, SearchIcon } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: Array<{
    description: string;
    amount: number;
    quantity: number;
    unitPrice: number;
  }>;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function InvoiceHistoryPage() {
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateRange: {
      start: null,
      end: null
    },
    currency: ''
  });

  useEffect(() => {
    fetchInvoices();
  }, [filters, pagination.page]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.dateRange.start) queryParams.append('startDate', filters.dateRange.start);
      if (filters.dateRange.end) queryParams.append('endDate', filters.dateRange.end);
      if (filters.currency) queryParams.append('currency', filters.currency);
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/invoices?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');
      
      const data = await response.json();
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, JSON.stringify(value));
      });

      const response = await fetch(`/api/invoices/export?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to export invoices');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${formatDate(new Date(), 'short')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export invoices');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoice History</h1>
        <Button onClick={handleExport} variant="outline">
          <DownloadIcon className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search invoices..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>

          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value })}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>

          <DateRangePicker
            value={filters.dateRange}
            onChange={(range) => setFilters({ ...filters, dateRange: range })}
          />

          <Select
            value={filters.currency}
            onValueChange={(value) => setFilters({ ...filters, currency: value })}
          >
            <option value="">All Currencies</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{formatDate(invoice.createdAt)}</td>
                <td>{formatDate(invoice.dueDate)}</td>
                <td>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    invoice.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.status}
                  </span>
                </td>
                <td>{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                  >
                    View PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t">
          <div className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
} 