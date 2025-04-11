'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { DownloadIcon, EyeIcon, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InvoiceListProps {
  invoices: any[]; // Type would be more specific in a real implementation
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
  };
}

export default function InvoiceList({ invoices, pagination }: InvoiceListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  
  // Render status badge with appropriate colors
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
              Paid
            </span>
          </div>
        );
      case 'PENDING':
        return (
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-blue-500 mr-1" />
            <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-full text-xs font-medium">
              Pending
            </span>
          </div>
        );
      case 'OVERDUE':
        return (
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
            <span className="text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-medium">
              Overdue
            </span>
          </div>
        );
      case 'CANCELLED':
        return (
          <div className="flex items-center">
            <XCircle className="h-4 w-4 text-gray-500 mr-1" />
            <span className="text-gray-700 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">
              Cancelled
            </span>
          </div>
        );
      default:
        return <span>{status}</span>;
    }
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };
  
  // Handle download invoice
  const handleDownload = async (invoiceId: string) => {
    try {
      setIsDownloading(invoiceId);
      const response = await fetch(`/api/invoices/${invoiceId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }
      
      // Create a blob from the PDF Stream
      const blob = await response.blob();
      
      // Create a download link and trigger click
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      // Would typically show an error toast here
    } finally {
      setIsDownloading(null);
    }
  };
  
  // Pagination logic
  const renderPagination = () => {
    const { currentPage, totalPages } = pagination;
    
    // If only one page, don't show pagination
    if (totalPages <= 1) {
      return null;
    }
    
    // Determine which page numbers to show
    let pages = [];
    
    if (totalPages <= 5) {
      // Show all pages if 5 or fewer
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      // Always include first, last, current, and neighbors
      const neighbors = [currentPage - 1, currentPage, currentPage + 1].filter(
        p => p > 0 && p <= totalPages
      );
      
      if (neighbors[0] > 1) {
        pages.push(1);
        if (neighbors[0] > 2) {
          pages.push('...');
        }
      }
      
      pages.push(...neighbors);
      
      if (neighbors[neighbors.length - 1] < totalPages) {
        if (neighbors[neighbors.length - 1] < totalPages - 1) {
          pages.push('...');
        }
        pages.push(totalPages);
      }
    }
    
    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          
          {pages.map((page, idx) => (
            <PaginationItem key={idx}>
              {page === '...' ? (
                <span className="px-4 py-2">...</span>
              ) : (
                <PaginationLink
                  onClick={() => handlePageChange(page as number)}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };
  
  // Empty state
  if (invoices.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <h2 className="text-xl font-medium mb-2">No invoices found</h2>
        <p className="text-gray-500 mb-4">
          There are no invoices matching your current filters.
        </p>
        <Button onClick={() => router.push(pathname)}>
          Clear All Filters
        </Button>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.number}
                </TableCell>
                <TableCell>
                  {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>
                  {invoice.organization.name}
                </TableCell>
                <TableCell>
                  {formatCurrency(invoice.amount, invoice.currency)}
                </TableCell>
                <TableCell>
                  {renderStatusBadge(invoice.status)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(invoice.id)}
                            disabled={isDownloading === invoice.id}
                          >
                            {isDownloading === invoice.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                            ) : (
                              <DownloadIcon className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download PDF</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/billing/invoices/${invoice.id}`}>
                            <Button variant="ghost" size="icon">
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View Details</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Showing {(pagination.currentPage - 1) * pagination.perPage + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.perPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} invoices
          </div>
          
          {renderPagination()}
        </div>
      </div>
    </div>
  );
} 