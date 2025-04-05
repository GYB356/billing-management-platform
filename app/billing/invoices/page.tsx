import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import InvoiceFilterBar from '@/components/billing/InvoiceFilterBar';
import InvoiceList from '@/components/billing/InvoiceList';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invoice History',
  description: 'View and download your invoice history',
};

export default async function InvoiceHistoryPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: string;
    maxAmount?: string;
    currency?: string;
    search?: string;
    page?: string;
    perPage?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session || !session.user) {
    redirect('/auth/signin');
  }
  
  // Parse query params
  const status = searchParams.status ? searchParams.status.split(',') : undefined;
  const dateFrom = searchParams.dateFrom ? new Date(searchParams.dateFrom) : undefined;
  const dateTo = searchParams.dateTo ? new Date(searchParams.dateTo) : undefined;
  const minAmount = searchParams.minAmount ? parseInt(searchParams.minAmount, 10) : undefined;
  const maxAmount = searchParams.maxAmount ? parseInt(searchParams.maxAmount, 10) : undefined;
  const currency = searchParams.currency;
  const search = searchParams.search;
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const perPage = searchParams.perPage ? parseInt(searchParams.perPage, 10) : 10;
  
  // Get user's organizations
  const userOrganizations = await prisma.userOrganization.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      organizationId: true,
    },
  });
  
  const organizationIds = userOrganizations.map(org => org.organizationId);
  
  // Build the filter conditions
  const where: any = {
    organizationId: {
      in: organizationIds,
    },
  };
  
  // Add filters based on search params
  if (status && status.length > 0) {
    where.status = { in: status };
  }
  
  if (dateFrom || dateTo) {
    where.createdAt = {};
    
    if (dateFrom) {
      where.createdAt.gte = dateFrom;
    }
    
    if (dateTo) {
      where.createdAt.lte = dateTo;
    }
  }
  
  if (minAmount || maxAmount) {
    where.amount = {};
    
    if (minAmount) {
      where.amount.gte = minAmount;
    }
    
    if (maxAmount) {
      where.amount.lte = maxAmount;
    }
  }
  
  if (currency) {
    where.currency = currency;
  }
  
  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { 
        organization: { 
          name: { contains: search, mode: 'insensitive' } 
        } 
      },
      {
        subscription: {
          plan: {
            name: { contains: search, mode: 'insensitive' }
          }
        }
      },
    ];
  }
  
  // Get total count for pagination
  const totalInvoices = await prisma.invoice.count({ where });
  
  // Get invoices with pagination
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      organization: true,
      subscription: {
        include: {
          plan: true,
        },
      },
      items: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: (page - 1) * perPage,
    take: perPage,
  });
  
  // Get available currencies for filter
  const availableCurrencies = await prisma.invoice.findMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
    select: {
      currency: true,
    },
    distinct: ['currency'],
  });
  
  const currencies = availableCurrencies.map(c => c.currency);
  
  // Stats/summary data
  const invoiceSummary = await prisma.$queryRaw`
    SELECT 
      currency,
      status,
      COUNT(*) as count,
      SUM(amount) as totalAmount
    FROM "Invoice"
    WHERE "organizationId" IN (${organizationIds.join(',')})
    GROUP BY currency, status
  `;
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoice History</h1>
      </div>
      
      <div className="mb-6">
        <InvoiceFilterBar 
          currencies={currencies}
          currentFilters={searchParams}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-medium mb-2">Total Invoices</h2>
          <p className="text-3xl font-bold">{totalInvoices}</p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-medium mb-2">Outstanding Balance</h2>
          <div className="space-y-2">
            {invoiceSummary
              .filter((summary: any) => summary.status === 'PENDING' || summary.status === 'OVERDUE')
              .map((summary: any) => (
                <p key={summary.currency} className="text-xl">
                  {formatCurrency(summary.totalAmount, summary.currency)}
                  <span className="text-sm text-gray-500 ml-2">({summary.count} invoices)</span>
                </p>
              ))}
            {invoiceSummary.filter((summary: any) => 
              summary.status === 'PENDING' || summary.status === 'OVERDUE'
            ).length === 0 && (
              <p className="text-xl">No outstanding invoices</p>
            )}
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-medium mb-2">Total Paid</h2>
          <div className="space-y-2">
            {invoiceSummary
              .filter((summary: any) => summary.status === 'PAID')
              .map((summary: any) => (
                <p key={summary.currency} className="text-xl">
                  {formatCurrency(summary.totalAmount, summary.currency)}
                  <span className="text-sm text-gray-500 ml-2">({summary.count} invoices)</span>
                </p>
              ))}
            {invoiceSummary.filter((summary: any) => summary.status === 'PAID').length === 0 && (
              <p className="text-xl">No paid invoices</p>
            )}
          </div>
        </div>
      </div>
      
      <InvoiceList 
        invoices={invoices}
        pagination={{
          currentPage: page,
          totalPages: Math.ceil(totalInvoices / perPage),
          totalItems: totalInvoices,
          perPage,
        }}
      />
    </div>
  );
} 