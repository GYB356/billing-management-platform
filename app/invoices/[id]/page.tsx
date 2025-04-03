'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from '@/components/ui/use-toast';
import { 
  ArrowLeftIcon, 
  CalendarIcon, 
  CheckIcon, 
  ClockIcon, 
  CreditCardIcon, 
  DownloadIcon, 
  FileEditIcon, 
  MailIcon, 
  PencilIcon, 
  RefreshCwIcon, 
  SendIcon, 
  SlidersHorizontalIcon, 
  XIcon 
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import DashboardShell from '@/components/dashboard-shell';
import LoadingSpinner from '@/components/loading-spinner';

interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

interface Invoice {
  id: string;
  number: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    taxId?: string;
  };
  subscriptionId: string;
  subscription?: {
    id: string;
    name: string;
    planId: string;
    plan?: {
      id: string;
      name: string;
    };
  };
  amount: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export default function InvoiceDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const isAdmin = session?.user?.role === 'ADMIN';
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [sendEmailLoading, setSendEmailLoading] = useState(false);
  
  // Fetch invoice details
  const fetchInvoice = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/invoices/${invoiceId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch invoice');
      }
      
      const data = await response.json();
      setInvoice(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching invoice:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial load
  useEffect(() => {
    if (authStatus === 'authenticated' && invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId, authStatus]);
  
  const handleDownloadInvoice = async () => {
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
      link.setAttribute('download', `invoice-${invoice?.number}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Invoice downloaded",
        description: "The invoice PDF has been downloaded successfully."
      });
      
    } catch (err) {
      console.error('Error downloading invoice:', err);
      toast({
        title: "Download failed",
        description: "Failed to download the invoice. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleSendInvoice = async () => {
    try {
      setSendEmailLoading(true);
      
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invoice');
      }
      
      await fetchInvoice(); // Refresh invoice data
      
      toast({
        title: "Invoice sent",
        description: "The invoice has been sent successfully."
      });
      
    } catch (err) {
      console.error('Error sending invoice:', err);
      toast({
        title: "Failed to send invoice",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive"
      });
    } finally {
      setSendEmailLoading(false);
    }
  };
  
  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setStatusUpdateLoading(true);
      
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update invoice status');
      }
      
      await fetchInvoice(); // Refresh invoice data
      
      toast({
        title: "Status updated",
        description: `Invoice status has been updated to ${newStatus.toLowerCase()}.`
      });
      
      } catch (err) {
      console.error('Error updating invoice status:', err);
      toast({
        title: "Status update failed",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive"
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete invoice');
      }
      
      toast({
        title: "Invoice deleted",
        description: "The invoice has been deleted successfully."
      });
      
      router.push('/invoices');
      
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive"
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-200 text-gray-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (loading) {
    return (
      <DashboardShell>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
      </div>
      </DashboardShell>
    );
  }
  
  if (error) {
    return (
      <DashboardShell>
        <div className="flex h-64 flex-col items-center justify-center">
          <div className="text-xl font-semibold text-red-600">Error</div>
          <p className="text-gray-600">{error}</p>
          <Button 
            onClick={() => fetchInvoice()}
            className="mt-4"
            variant="outline"
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Retry
          </Button>
      </div>
      </DashboardShell>
    );
  }
  
  if (!invoice) {
    return (
      <DashboardShell>
        <div className="flex h-64 flex-col items-center justify-center">
          <div className="text-xl font-semibold">Invoice Not Found</div>
          <p className="text-gray-600">The invoice you're looking for doesn't exist or you don't have permission to view it.</p>
          <Button 
            asChild
            className="mt-4"
          >
            <Link href="/invoices">
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Back to Invoices
            </Link>
          </Button>
      </div>
      </DashboardShell>
    );
  }

  const calculateTotal = () => {
    let subtotal = 0;
    let tax = 0;
    
    invoice.items.forEach(item => {
      subtotal += item.amount;
      if (item.taxAmount) {
        tax += item.taxAmount;
      }
    });
    
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  };

  const totals = calculateTotal();
  
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              asChild
              className="h-8 w-8 p-0"
            >
              <Link href="/invoices">
                <ArrowLeftIcon className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Invoice #{invoice.number}</h1>
            <Badge className={getStatusBadgeColor(invoice.status)}>
              {invoice.status}
            </Badge>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleDownloadInvoice}
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            
            {invoice.status === 'DRAFT' && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  asChild
                >
                  <Link href={`/invoices/${invoice.id}/customize`}>
                    <FileEditIcon className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSendInvoice}
                  disabled={sendEmailLoading}
                >
                  {sendEmailLoading ? (
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                  ) : (
                    <SendIcon className="mr-2 h-4 w-4" />
                  )}
                  Send
                </Button>
              </>
            )}
            
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <XIcon className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete Invoice #{invoice.number}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteInvoice}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Number:</span>
                  <span className="font-medium">{invoice.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issue Date:</span>
                  <span className="font-medium">{format(new Date(invoice.issuedAt), 'PP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">{format(new Date(invoice.dueDate), 'PP')}</span>
                </div>
                {invoice.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid Date:</span>
                    <span className="font-medium">{format(new Date(invoice.paidAt), 'PP')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
                {invoice.status === 'OVERDUE' && (
                  <div className="flex justify-between text-red-600">
                    <span>Overdue by:</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(invoice.dueDate))}
                    </span>
                  </div>
                )}
              </div>
              
              {isAdmin && invoice.status !== 'CANCELLED' && (
                <div className="pt-4">
                  <p className="mb-2 text-sm text-muted-foreground">Update Status:</p>
                  <div className="flex flex-wrap gap-2">
                    {['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'].map((status) => (
                      invoice.status !== status && (
                        <Button
                          key={status}
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(status)}
                          disabled={statusUpdateLoading}
                        >
                          {status === 'PAID' && <CheckIcon className="mr-1 h-3 w-3" />}
                          {status === 'SENT' && <MailIcon className="mr-1 h-3 w-3" />}
                          {status === 'OVERDUE' && <ClockIcon className="mr-1 h-3 w-3" />}
                          {status === 'CANCELLED' && <XIcon className="mr-1 h-3 w-3" />}
                          Mark as {status.toLowerCase()}
                        </Button>
                      )
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Bill To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div className="font-medium">{invoice.organization.name}</div>
                {invoice.organization.address && (
                  <div className="text-muted-foreground">{invoice.organization.address}</div>
                )}
                {invoice.organization.email && (
                  <div className="flex items-center text-muted-foreground">
                    <MailIcon className="mr-2 h-3 w-3" />
                    {invoice.organization.email}
                  </div>
                )}
                {invoice.organization.taxId && (
                  <div className="flex items-center text-muted-foreground">
                    <SlidersHorizontalIcon className="mr-2 h-3 w-3" />
                    Tax ID: {invoice.organization.taxId}
                  </div>
                )}
              </div>
              
              {invoice.subscription && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Subscription</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{invoice.subscription.name}</span>
                      </div>
                      {invoice.subscription.plan && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan:</span>
                          <span className="font-medium">{invoice.subscription.plan.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  {invoice.items.some(item => item.taxRate) && (
                    <TableHead className="text-right">Tax Rate</TableHead>
                  )}
                  {invoice.items.some(item => item.taxAmount) && (
                    <TableHead className="text-right">Tax</TableHead>
                  )}
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice, invoice.currency)}</TableCell>
                    {invoice.items.some(item => item.taxRate) && (
                      <TableCell className="text-right">{item.taxRate ? `${item.taxRate}%` : '-'}</TableCell>
                    )}
                    {invoice.items.some(item => item.taxAmount) && (
                      <TableCell className="text-right">{item.taxAmount ? formatCurrency(item.taxAmount, invoice.currency) : '-'}</TableCell>
                    )}
                    <TableCell className="text-right">{formatCurrency(item.amount, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right font-medium">Subtotal</TableCell>
                  <TableCell colSpan={invoice.items.some(item => item.taxRate) ? 1 : 0} />
                  <TableCell colSpan={invoice.items.some(item => item.taxAmount) ? 1 : 0} />
                  <TableCell className="text-right font-medium">{formatCurrency(totals.subtotal, invoice.currency)}</TableCell>
                </TableRow>
                {totals.tax > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-medium">Tax</TableCell>
                    <TableCell colSpan={invoice.items.some(item => item.taxRate) ? 1 : 0} />
                    <TableCell colSpan={invoice.items.some(item => item.taxAmount) ? 1 : 0} />
                    <TableCell className="text-right font-medium">{formatCurrency(totals.tax, invoice.currency)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right text-lg font-bold">Total</TableCell>
                  <TableCell colSpan={invoice.items.some(item => item.taxRate) ? 1 : 0} />
                  <TableCell colSpan={invoice.items.some(item => item.taxAmount) ? 1 : 0} />
                  <TableCell className="text-right text-lg font-bold">{formatCurrency(totals.total, invoice.currency)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          {invoice.notes && (
            <CardFooter>
              <div className="w-full space-y-2">
                <h3 className="font-medium">Notes</h3>
                <p className="text-sm text-muted-foreground">{invoice.notes}</p>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
} 