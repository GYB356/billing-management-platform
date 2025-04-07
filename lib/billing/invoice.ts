import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function generateInvoiceNumber(): Promise<string> {
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
  });

  const nextNumber = lastInvoice
    ? parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1
    : 1;

  return `INV-${String(nextNumber).padStart(6, '0')}`;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface CreateInvoiceData {
  customerId: string;
  subscriptionId: string;
  items: InvoiceItem[];
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  tax?: number;
  discount?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export async function createInvoice(data: CreateInvoiceData): Promise<Invoice> {
  const {
    customerId,
    subscriptionId,
    items,
    dueDate,
    periodStart,
    periodEnd,
    tax = 0,
    discount = 0,
    notes,
    metadata,
  } = data;

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );
  const amountDue = subtotal + (tax || 0) - (discount || 0);

  const invoiceNumber = await generateInvoiceNumber();

  return prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId,
      subscriptionId,
      items: items as Prisma.JsonValue,
      dueDate,
      periodStart,
      periodEnd,
      subtotal,
      tax,
      discount,
      amountDue,
      amountPaid: 0,
      notes,
      metadata: metadata as Prisma.JsonValue,
      status: InvoiceStatus.DRAFT,
    },
  });
}

export async function finalizeInvoice(invoiceId: string): Promise<Invoice> {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.OPEN },
  });
}

export async function markInvoiceAsPaid(
  invoiceId: string,
  paymentMethodId: string,
  paymentIntentId: string,
  receiptUrl?: string
): Promise<Invoice> {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: InvoiceStatus.PAID,
      datePaid: new Date(),
      amountPaid: {
        set: prisma.invoice
          .findUnique({
            where: { id: invoiceId },
          })
          .then((inv) => inv?.amountDue || 0),
      },
      paymentMethodId,
      paymentIntentId,
      receiptUrl,
    },
  });

  // Create a transaction record
  await prisma.transaction.create({
    data: {
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscriptionId,
      amount: invoice.amountDue,
      currency: invoice.currency,
      type: 'CHARGE',
      status: 'SUCCEEDED',
      paymentMethodId,
      paymentIntentId,
      description: `Payment for invoice ${invoice.invoiceNumber}`,
    },
  });

  return invoice;
}

export async function voidInvoice(invoiceId: string): Promise<Invoice> {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.VOID },
  });
}

export async function getInvoiceWithDetails(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      subscription: true,
      paymentMethod: true,
      taxRates: {
        include: {
          taxRate: true,
        },
      },
      transactions: true,
    },
  });
}
