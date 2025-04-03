import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentHistory } from '@/components/admin/PaymentHistory';

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Check if user has admin permissions
  const hasPermission = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      role: 'ADMIN',
    },
  });

  if (!hasPermission) {
    redirect('/dashboard');
  }

  // Fetch all payments with related data
  const payments = await prisma.payment.findMany({
    include: {
      invoice: {
        select: {
          number: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all payment transactions across organizations.
        </p>
      </div>
      <PaymentHistory payments={payments} />
    </div>
  );
} 