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
import { notFound } from 'next/navigation';
import { getInvoice } from '@/lib/api/invoices';

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

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const invoice = await getInvoice(id);

    if (!invoice) {
      return notFound();
    }

    // Fetch invoice details
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/invoices/${id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch invoice');
        }
        
        const data = await response.json();
        return data;
      } catch (err) {
        console.error('Error fetching invoice:', err);
        throw err;
      }
    };

    const invoiceData = await fetchInvoice();

    const calculateTotal = () => {
      let subtotal = 0;
      let tax = 0;
      
      invoiceData.items.forEach(item => {
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
              <h1 className="text-2xl font-bold tracking-tight">Invoice #{invoiceData.number}</h1>
              <Badge className={getStatusBadgeColor(invoiceData.status)}>
                {invoiceData.status}
              </Badge>
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
                    <span className="font-medium">{invoiceData.number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Issue Date:</span>
                    <span className="font-medium">{format(new Date(invoiceData.issuedAt), 'PP')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span className="font-medium">{format(new Date(invoiceData.dueDate), 'PP')}</span>
                  </div>
                  {invoiceData.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid Date:</span>
                      <span className="font-medium">{format(new Date(invoiceData.paidAt), 'PP')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium">{formatCurrency(invoiceData.amount, invoiceData.currency)}</span>
                  </div>
                  {invoiceData.status === 'OVERDUE' && (
                    <div className="flex justify-between text-red-600">
                      <span>Overdue by:</span>
                      <span className="font-medium">
                        {formatDistanceToNow(new Date(invoiceData.dueDate))}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Bill To</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="font-medium">{invoiceData.organization.name}</div>
                  {invoiceData.organization.address && (
                    <div className="text-muted-foreground">{invoiceData.organization.address}</div>
                  )}
                  {invoiceData.organization.email && (
                    <div className="flex items-center text-muted-foreground">
                      <MailIcon className="mr-2 h-3 w-3" />
                      {invoiceData.organization.email}
                    </div>
                  )}
                  {invoiceData.organization.taxId && (
                    <div className="flex items-center text-muted-foreground">
                      <SlidersHorizontalIcon className="mr-2 h-3 w-3" />
                      Tax ID: {invoiceData.organization.taxId}
                    </div>
                  )}
                </div>
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
                    {invoiceData.items.some(item => item.taxRate) && (
                      <TableHead className="text-right">Tax Rate</TableHead>
                    )}
                    {invoiceData.items.some(item => item.taxAmount) && (
                      <TableHead className="text-right">Tax</TableHead>
                    )}
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice, invoiceData.currency)}</TableCell>
                      {invoiceData.items.some(item => item.taxRate) && (
                        <TableCell className="text-right">{item.taxRate ? `${item.taxRate}%` : '-'}</TableCell>
                      )}
                      {invoiceData.items.some(item => item.taxAmount) && (
                        <TableCell className="text-right">{item.taxAmount ? formatCurrency(item.taxAmount, invoiceData.currency) : '-'}</TableCell>
                      )}
                      <TableCell className="text-right">{formatCurrency(item.amount, invoiceData.currency)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-medium">Subtotal</TableCell>
                    <TableCell colSpan={invoiceData.items.some(item => item.taxRate) ? 1 : 0} />
                    <TableCell colSpan={invoiceData.items.some(item => item.taxAmount) ? 1 : 0} />
                    <TableCell className="text-right font-medium">{formatCurrency(totals.subtotal, invoiceData.currency)}</TableCell>
                  </TableRow>
                  {totals.tax > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} />
                      <TableCell className="text-right font-medium">Tax</TableCell>
                      <TableCell colSpan={invoiceData.items.some(item => item.taxRate) ? 1 : 0} />
                      <TableCell colSpan={invoiceData.items.some(item => item.taxAmount) ? 1 : 0} />
                      <TableCell className="text-right font-medium">{formatCurrency(totals.tax, invoiceData.currency)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right text-lg font-bold">Total</TableCell>
                    <TableCell colSpan={invoiceData.items.some(item => item.taxRate) ? 1 : 0} />
                    <TableCell colSpan={invoiceData.items.some(item => item.taxAmount) ? 1 : 0} />
                    <TableCell className="text-right text-lg font-bold">{formatCurrency(totals.total, invoiceData.currency)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  } catch (error) {
    console.error('Error loading invoice:', error);
    return <div>Error loading invoice</div>;
  }
}