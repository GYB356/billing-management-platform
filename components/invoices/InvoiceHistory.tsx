'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, DownloadIcon, FilterIcon, SearchIcon, XIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { DateRangePicker } from '@/components/DateRangePicker';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  organization: {
    name: string;
  };
}

interface InvoiceHistoryProps {
  organizationId?: string; // Optional: If provided, only show invoices for this organization
  isAdmin?: boolean; // Optional: If true, show organization column and more actions
}

export function InvoiceHistory({ organizationId, isAdmin = false }: InvoiceHistoryProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [currencyFilter, setCurrencyFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/invoices?page=${page}&pageSize=${pageSize}`;
      
      if (organizationId) {
        url += `&organizationId=${organizationId}`;
      }
      
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      
      if (dateRange.from) {
        url += `&startDate=${dateRange.from.toISOString()}`;
      }
      
      if (dateRange.to) {
        url += `&endDate=${dateRange.to.toISOString()}`;
      }
      
      if (currencyFilter) {
        url += `&currency=${currencyFilter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.invoices);
      setTotalCount(data.totalCount);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Could not load invoices. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, organizationId, statusFilter, currencyFilter, dateRange]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page when searching
    fetchInvoices();
  };
  
  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }
      
      // Get the PDF blob
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    }
  };
  
  const handleGenerateInvoice = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}/customize`);
  };
  
  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`);
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCurrencyFilter('');
    setDateRange({ from: undefined, to: undefined });
    setPage(1);
  };
  
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      DRAFT: { color: 'bg-gray-200 text-gray-800', label: 'Draft' },
      PENDING: { color: 'bg-yellow-200 text-yellow-800', label: 'Pending' },
      PAID: { color: 'bg-green-200 text-green-800', label: 'Paid' },
      OVERDUE: { color: 'bg-red-200 text-red-800', label: 'Overdue' },
      CANCELLED: { color: 'bg-gray-200 text-gray-800', label: 'Cancelled' },
      REFUNDED: { color: 'bg-purple-200 text-purple-800', label: 'Refunded' }
    };
    
    const statusInfo = statusMap[status] || { color: 'bg-gray-200 text-gray-800', label: status };
    
    return (
      <Badge className={`${statusInfo.color}`}>
        {statusInfo.label}
      </Badge>
    );
  };
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100); // Convert cents to dollars
  };
  
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Invoice History</CardTitle>
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search invoice number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[200px] sm:w-[300px]"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2">
              <Label htmlFor="status" className="sr-only">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status" className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Label htmlFor="currency" className="sr-only">Currency</Label>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger id="currency" className="w-[130px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Currencies</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              className="w-[280px]"
            />
            
            {(searchTerm || statusFilter || currencyFilter || dateRange.from || dateRange.to) && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="flex items-center">
                <XIcon className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-6">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center p-6 text-red-500">{error}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center p-6 text-gray-500">No invoices found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice Number
                    </th>
                    {isAdmin && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organization
                      </th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.number}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invoice.organization.name}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice.id)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          className="flex items-center"
                        >
                          <DownloadIcon className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                        {(invoice.status === 'DRAFT' || isAdmin) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateInvoice(invoice.id)}
                          >
                            Customize
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500">
                  Showing {Math.min((page - 1) * pageSize + 1, totalCount)} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries
                </p>
                <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 