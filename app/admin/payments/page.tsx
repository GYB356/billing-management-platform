<<<<<<< HEAD
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
=======
import { useEffect, useState } from 'react';

export default function PaymentManagement() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    async function fetchPayments() {
      const response = await fetch('/api/admin/payments');
      const data = await response.json();
      setPayments(data);
    }
    fetchPayments();
  }, []);

  const refundPayment = async (id) => {
    await fetch(`/api/admin/payments/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 }), // Example refund amount
    });
    // Refresh payments
    fetchPayments();
  };

  return (
    <div>
      <h1>Payment Management</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.id}</td>
              <td>{payment.userId}</td>
              <td>{payment.amount}</td>
              <td>{payment.status}</td>
              <td>
                <button onClick={() => refundPayment(payment.id)}>Refund</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
>>>>>>> 58d4a3da7158e64e5700c51b28776197a8d974c9
