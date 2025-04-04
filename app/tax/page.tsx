import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TaxManagementContent } from '@/components/tax/TaxManagementContent';

export default async function TaxManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return <TaxManagementContent organizationId={session.user.organizationId} />;
}