import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import { stripe } from './stripe';
import { InvoiceTemplate, InvoiceTemplateOptions } from './invoice-templates';
import { prisma } from './prisma';
import { CurrencyService } from './currency';

const prismaClient = new PrismaClient();

export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  organization: {
    name: string;
    email: string;
    address?: string;
    taxId?: string;
    country?: string;
    state?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  exchangeRate?: {
    from: string;
    to: string;
    rate: number;
  };
  paymentMethods?: string[];
  customerReference?: string;
  digitalSignature?: {
    signedBy: string;
    signedAt: Date;
    signatureImage?: Buffer;
  };
  alternativeCurrencies?: Array<{
    currency: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    exchangeRate: number;
  }>;
  customFields?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
}

export class InvoiceService {
  static async generateInvoice(invoiceId: string, templateOptions?: InvoiceTemplateOptions): Promise<Buffer> {
    const invoice = await prismaClient.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            organization: true,
            plan: true,
          },
        },
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get tax rate and calculate tax
    const taxResult = await CurrencyService.calculateTax(
      invoice.amount,
      invoice.currency,
      invoice.subscription.organization
    );

    // Get customer reference if available
    const customerReference = invoice.metadata?.customerReference as string || undefined;

    // Get payment methods from payments
    const paymentMethods = invoice.payments.map(payment => payment.method).filter(Boolean);

    const invoiceData: InvoiceData = {
      invoiceNumber: invoice.number,
      date: invoice.createdAt,
      dueDate: invoice.dueDate,
      organization: {
        name: invoice.subscription.organization.name,
        email: invoice.subscription.organization.email || '',
        address: invoice.subscription.organization.address || '',
        taxId: invoice.subscription.organization.taxId || '',
        country: invoice.subscription.organization.country || '',
        state: invoice.subscription.organization.state || '',
      },
      items: invoice.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
        currency: invoice.currency,
      })),
      subtotal: invoice.amount,
      taxRate: taxResult.taxRate,
      taxAmount: taxResult.taxAmount,
      totalAmount: taxResult.totalAmount,
      currency: invoice.currency,
      notes: invoice.metadata?.notes as string,
      paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
      customerReference: customerReference,
    };

    // If the organization's preferred currency is different from the invoice currency,
    // add exchange rate information and alternative currency amounts
    if (invoice.subscription.organization.preferredCurrency && 
        invoice.subscription.organization.preferredCurrency !== invoice.currency) {
      
      const exchangeRate = await CurrencyService.getExchangeRate(
        invoice.currency,
        invoice.subscription.organization.preferredCurrency
      );
      
      invoiceData.exchangeRate = {
        from: invoice.currency,
        to: invoice.subscription.organization.preferredCurrency,
        rate: exchangeRate,
      };

      // Add alternative currency data
      invoiceData.alternativeCurrencies = [{
        currency: invoice.subscription.organization.preferredCurrency,
        subtotal: Math.round(invoice.amount * exchangeRate),
        taxAmount: Math.round(taxResult.taxAmount * exchangeRate),
        totalAmount: Math.round(taxResult.totalAmount * exchangeRate),
        exchangeRate: exchangeRate,
      }];
    }

    // Add custom fields if available
    if (invoice.metadata?.customFields) {
      invoiceData.customFields = invoice.metadata.customFields as Array<{
        key: string;
        label: string;
        value: string;
      }>;
    }

    // Add digital signature if enabled in the template
    if (templateOptions?.digitalSignature?.enabled) {
      invoiceData.digitalSignature = {
        signedBy: templateOptions.digitalSignature.name || 'Authorized Signatory',
        signedAt: templateOptions.digitalSignature.date || new Date(),
        signatureImage: templateOptions.digitalSignature.signature,
      };
    }

    // Create template with options
    const template = new InvoiceTemplate(templateOptions);
    return template.generate(invoiceData);
  }

  static async createInvoiceFromSubscription(subscriptionId: string): Promise<string> {
    const subscription = await prismaClient.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        organization: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate tax based on organization's location
    const taxResult = await CurrencyService.calculateTax(
      subscription.plan.basePrice,
      subscription.plan.currency,
      subscription.organization
    );

    // Create invoice
    const invoice = await prismaClient.invoice.create({
      data: {
        number: invoiceNumber,
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        amount: subscription.plan.basePrice,
        currency: subscription.plan.currency,
        taxRate: taxResult.taxRate,
        taxAmount: taxResult.taxAmount,
        totalAmount: taxResult.totalAmount,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        items: {
          create: {
            description: `${subscription.plan.name} Subscription`,
            quantity: 1,
            unitPrice: subscription.plan.basePrice,
            amount: subscription.plan.basePrice,
            taxRate: taxResult.taxRate,
            taxAmount: taxResult.taxAmount,
            totalAmount: taxResult.totalAmount,
          },
        },
      },
    });

    // Create Stripe invoice
    if (subscription.stripeSubscriptionId) {
      const stripeInvoice = await stripe.invoices.create({
        subscription: subscription.stripeSubscriptionId,
        collection_method: 'charge_automatically',
      });

      await prismaClient.invoice.update({
        where: { id: invoice.id },
        data: {
          stripeInvoiceId: stripeInvoice.id,
        },
      });
    }

    return invoice.id;
  }

  // Create a bulk invoice generation method for an organization
  static async generateInvoicesForOrganization(organizationId: string, startDate: Date, endDate: Date): Promise<string[]> {
    // Find all active subscriptions for the organization
    const subscriptions = await prismaClient.subscription.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        // Only include subscriptions that have not been invoiced for this period
        NOT: {
          invoices: {
            some: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          }
        }
      }
    });

    if (subscriptions.length === 0) {
      throw new Error('No active subscriptions found for this organization');
    }

    // Create invoices for each subscription
    const invoiceIds = await Promise.all(
      subscriptions.map(async (subscription) => {
        return this.createInvoiceFromSubscription(subscription.id);
      })
    );

    return invoiceIds;
  }
} 