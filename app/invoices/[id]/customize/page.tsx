'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceTemplateForm } from '@/components/invoices/InvoiceTemplateForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';

interface PageProps {
  params: {
    id: string;
  };
}

export default function CustomizeInvoicePage({ params }: PageProps) {
  const router = useRouter();
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id: params.id },
          include: {
            subscription: {
              include: {
                organization: true,
              },
            },
          },
        });

        if (!invoice) {
          router.push('/invoices');
          return;
        }

        setOrganization(invoice.subscription.organization);
      } catch (error) {
        console.error('Error fetching organization:', error);
        router.push('/invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Customize Invoice Template</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice #{params.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceTemplateForm
            invoiceId={params.id}
            organization={organization}
            defaultOptions={{
              showTaxDetails: true,
              showTaxBreakdown: true,
              showExchangeRate: true,
              showPaymentInstructions: true,
              paymentInstructions: 'Please make payment to the bank account below:',
              footerText: 'Thank you for your business!',
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
} 