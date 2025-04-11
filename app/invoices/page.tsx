'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { 
  DownloadIcon, 
  FilterIcon, 
  PlusIcon, 
  RefreshCwIcon, 
  SearchIcon, 
  SlidersHorizontalIcon 
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import DashboardShell from '@/components/dashboard-shell';
import EmptyState from '@/components/empty-state';
import LoadingSpinner from '@/components/loading-spinner';

interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  number: string;
  organizationId: string;
  organizationName?: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export default function InvoicesPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateRange: { from: undefined, to: undefined } as { from: Date | undefined, to: Date | undefined },
    currency: '',
    organizationId: '',
  });
  
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch invoices with filters
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      let queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.currency) queryParams.append('currency', filters.currency);
      if (filters.organizationId) queryParams.append('organizationId', filters.organizationId);
      
      if (filters.dateRange.from) {
        queryParams.append('startDate', filters.dateRange.from.toISOString());
      }
      
      if (filters.dateRange.to) {
        queryParams.append('endDate', filters.dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/invoices?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.invoices);
      setTotalInvoices(data.total);
      setTotalPages(Math.ceil(data.total / pageSize));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial load and when filters/pagination change
  useEffect(() => {
    if (status === 'authenticated') {
      fetchInvoices();
    }
  }, [page, pageSize, status, filters]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
    setPage(1); // Reset to first page when search changes
  };
  
  const handleStatusChange = (value: string) => {
    setFilters(prev => ({ ...prev, status: value }));
    setPage(1);
  };
  
  const handleCurrencyChange = (value: string) => {
    setFilters(prev => ({ ...prev, currency: value }));
    setPage(1);
  };
  
  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
    setPage(1);
  };
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setPage(1); // Reset to first page when page size changes
  };
  
  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }
      
      // Create a blob from the PDF stream
      const blob = await response.blob();
      
      // Create a link element and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error downloading invoice:', err);
      // You might want to show a notification here
    }
  };
  
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      case 'SENT':
        return 'bg-blue-100 text-blue-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'CANCELLED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (status === 'loading') {
    return <LoadingSpinner />;
  }
  
  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
            <CardDescription>
              You need to be logged in to view this page.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button className="w-full">Log in</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <DashboardShell>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage and view your billing invoices
          </p>
        </div>
        
        {isAdmin && (
          <Link href="/invoices/create">
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </Link>
        )}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-8"
                value={filters.search}
                onChange={handleSearchChange}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon className="h-4 w-4 mr-2" />
                Filters
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => fetchInvoices()}
              >
                <RefreshCwIcon className="h-4 w-4" />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select 
                  value={filters.status} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Currency</label>
                <Select 
                  value={filters.currency} 
                  onValueChange={handleCurrencyChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All currencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All currencies</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Date Range</label>
                <DatePickerWithRange 
                  date={filters.dateRange}
                  setDate={handleDateRangeChange}
                />
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">
              <p>{error}</p>
              <Button 
                variant="outline" 
                onClick={() => fetchInvoices()} 
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState 
              title="No invoices found" 
              description={
                filters.search || filters.status || filters.dateRange.from || filters.currency
                  ? "Try adjusting your filters"
                  : "Create your first invoice to get started"
              }
              action={
                isAdmin && !filters.search && !filters.status && !filters.dateRange.from && !filters.currency
                  ? {
                      label: "Create Invoice",
                      href: "/invoices/create"
                    }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/invoices/${invoice.id}`}
                          className="hover:underline"
                        >
                          {invoice.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.issuedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                        {invoice.status === 'OVERDUE' && (
                          <span className="text-red-500 text-xs block">
                            {formatDistanceToNow(new Date(invoice.dueDate), { addSuffix: true })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(invoice.status)}>
                          {invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadInvoice(invoice.id)}
                            title="Download PDF"
                          >
                            <DownloadIcon className="h-4 w-4" />
                            <span className="sr-only">Download</span>
                          </Button>
                          
                          <Link href={`/invoices/${invoice.id}/customize`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Customize"
                            >
                              <SlidersHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Customize</span>
                            </Button>
                          </Link>
                          
                          <Link href={`/invoices/${invoice.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="View Details"
                            >
                              View
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        
        {!loading && !error && invoices.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center border-t px-6 py-4">
            <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalInvoices)} of {totalInvoices} invoices
            </div>
            
            <div className="flex items-center gap-4">
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
              
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => handlePageChange(Math.max(1, page - 1))}
                      disabled={page === 1}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Logic to show pages around current page
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => handlePageChange(pageNum)}
                          isActive={pageNum === page}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardFooter>
        )}
      </Card>
    </DashboardShell>
  );
} 