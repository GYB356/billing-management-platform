import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccountTabs } from '@/components/account/account-tabs';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Manage your account and subscription',
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        include: {
          subscriptions: {
            include: {
              plan: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          invoices: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
        },
      },
    },
  });
  
  if (!user) {
    redirect('/auth/signin');
  }
  
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Account Dashboard</h1>
      <AccountTabs user={user} />
    </div>
  );
}
