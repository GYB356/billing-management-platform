import { prisma } from '@/lib/prisma';
import CustomerTable from '@/components/admin/customers/CustomerTable';
import CustomerFilters from '@/components/admin/customers/CustomerFilters';
import CustomerSearch from '@/components/admin/customers/CustomerSearch';

async function getCustomers(searchParams: { [key: string]: string | string[] | undefined }) {
  const {
    status,
    search,
    page = '1',
    limit = '10',
  } = searchParams;

  const where = {
    AND: [
      search ? {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { stripeCustomerId: { contains: search as string, mode: 'insensitive' } },
        ],
      } : {},
      status ? {
        subscriptions: {
          some: {
            status: status as string,
          },
        },
      } : {},
    ],
  };

  const [customers, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
        },
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    customers,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { customers, total, page, limit } = await getCustomers(searchParams);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <div className="flex space-x-4">
          <CustomerSearch />
        </div>
      </div>

      <CustomerFilters />

      <div className="bg-white shadow rounded-lg">
        <CustomerTable
          customers={customers}
          total={total}
          page={page}
          limit={limit}
        />
      </div>
    </div>
  );
} 