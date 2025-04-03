import { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface TaxLayoutProps {
  children: ReactNode;
}

export default async function TaxLayout({ children }: TaxLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Tax Management</h1>
            <p className="text-muted-foreground">
              Manage tax rates and generate tax reports for your organization.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
} 