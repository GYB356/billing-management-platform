import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import CustomerDetails from '@/components/admin/customers/CustomerDetails';

interface CustomerPageProps {
  params: {
    id: string;
  };
}

async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return customer;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const customer = await getCustomer(params.id);

  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Customer Details</h1>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <CustomerDetails customer={customer} />
        </div>
      </div>
    </div>
  );
} 