import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { InvoiceTemplateForm } from '@/components/invoices/InvoiceTemplateForm';

interface InvoiceTemplatePageProps {
  params: {
    id: string;
  };
}

export default async function InvoiceTemplatePage({ params }: InvoiceTemplatePageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  // Get invoice details
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      subscription: {
        include: {
          organization: true,
          plan: true,
        },
      },
    },
  });

  if (!invoice) {
    redirect('/invoices');
  }

  // Get organization settings for default template options
  const organization = await prisma.organization.findUnique({
    where: { id: invoice.organizationId },
    select: {
      name: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      taxId: true,
      settings: true,
    },
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Customize Invoice Template</h1>
      <InvoiceTemplateForm
        invoiceId={params.id}
        organization={organization}
        defaultOptions={{
          companyDetails: {
            name: organization?.name || '',
            address: organization?.address || '',
            phone: organization?.phone || '',
            email: organization?.email || '',
            website: organization?.website || '',
            taxId: organization?.taxId || '',
          },
          showTaxDetails: true,
          showPaymentInstructions: true,
          paymentInstructions: 'Please make payment to the bank account below:',
          footerText: 'Thank you for your business!',
        }}
      />
    </div>
  );
} 