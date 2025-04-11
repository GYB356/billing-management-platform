import prisma from '@/lib/prisma';
import { createEvent } from '../events';

export interface CreditAdjustmentParams {
  customerId: string;
  organizationId: string;
  amount: number;
  description: string;
  reason?: string;
  metadata?: Record<string, any>;
  adjustedById: string;
}

export async function addCredit(params: CreditAdjustmentParams) {
  const { 
    customerId, 
    organizationId, 
    amount, 
    description, 
    reason, 
    metadata, 
    adjustedById 
  } = params;

  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  // Check if the customer exists and belongs to the organization
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      organizationId,
    },
  });

  if (!customer) {
    throw new Error('Customer not found or does not belong to the organization');
  }

  // Create a transaction to update the customer's credit balance and create a credit adjustment
  return await prisma.$transaction(async (tx) => {
    // Update customer credit balance
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId },
      data: {
        creditBalance: {
          increment: amount,
        },
      },
    });

    // Create credit adjustment record
    const creditAdjustment = await tx.creditAdjustment.create({
      data: {
        customerId,
        organizationId,
        amount,
        type: 'CREDIT',
        description,
        reason,
        metadata,
        adjustedById,
      },
    });

    // Create event for credit adjustment
    await createEvent({
      eventType: 'CREDIT_ADDED',
      resourceType: 'CUSTOMER',
      resourceId: customerId,
      severity: 'INFO',
      metadata: {
        adjustmentId: creditAdjustment.id,
        customerId,
        amount,
        newBalance: updatedCustomer.creditBalance,
        description,
        reason,
      },
    });

    return { 
      creditAdjustment, 
      newBalance: updatedCustomer.creditBalance 
    };
  });
}

export async function deductCredit(params: CreditAdjustmentParams) {
  const { 
    customerId, 
    organizationId, 
    amount, 
    description, 
    reason, 
    metadata, 
    adjustedById 
  } = params;

  if (amount <= 0) {
    throw new Error('Deduction amount must be positive');
  }

  // Check if the customer exists and belongs to the organization
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      organizationId,
    },
  });

  if (!customer) {
    throw new Error('Customer not found or does not belong to the organization');
  }

  // Check if customer has enough credit
  if (customer.creditBalance < amount) {
    throw new Error('Insufficient credit balance');
  }

  // Create a transaction to update the customer's credit balance and create a credit adjustment
  return await prisma.$transaction(async (tx) => {
    // Update customer credit balance
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId },
      data: {
        creditBalance: {
          decrement: amount,
        },
      },
    });

    // Create credit adjustment record
    const creditAdjustment = await tx.creditAdjustment.create({
      data: {
        customerId,
        organizationId,
        amount: -amount, // Store as negative for deduction
        type: 'DEBIT',
        description,
        reason,
        metadata,
        adjustedById,
      },
    });

    // Create event for credit adjustment
    await createEvent({
      eventType: 'CREDIT_DEDUCTED',
      resourceType: 'CUSTOMER',
      resourceId: customerId,
      severity: 'INFO',
      metadata: {
        adjustmentId: creditAdjustment.id,
        customerId,
        amount,
        newBalance: updatedCustomer.creditBalance,
        description,
        reason,
      },
    });

    return { 
      creditAdjustment, 
      newBalance: updatedCustomer.creditBalance 
    };
  });
}

export async function applyCredit(
  customerId: string,
  invoiceId: string,
  amount: number,
  adjustedById: string
) {
  // Check if the customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Check if the invoice exists and belongs to the customer
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      customerId,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found or does not belong to the customer');
  }

  // Check if the invoice is already paid
  if (invoice.status === 'PAID') {
    throw new Error('Invoice is already paid');
  }

  // Check if customer has enough credit
  if (customer.creditBalance < amount) {
    throw new Error('Insufficient credit balance');
  }

  // Check if amount is not greater than remaining invoice amount
  const remainingAmount = invoice.total - (invoice.paidAmount || 0);
  if (amount > remainingAmount) {
    throw new Error('Credit amount exceeds remaining invoice amount');
  }

  // Create a transaction to apply credit to the invoice
  return await prisma.$transaction(async (tx) => {
    // Update customer credit balance
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId },
      data: {
        creditBalance: {
          decrement: amount,
        },
      },
    });

    // Update invoice with applied credit
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: {
          increment: amount,
        },
        status: amount === remainingAmount ? 'PAID' : 'PARTIAL',
        ...(amount === remainingAmount ? { paidAt: new Date() } : {}),
      },
    });

    // Create credit adjustment record
    const creditAdjustment = await tx.creditAdjustment.create({
      data: {
        customerId,
        organizationId: customer.organizationId,
        amount: -amount, // Store as negative for deduction
        type: 'INVOICE_PAYMENT',
        description: `Applied credit to invoice #${invoice.number}`,
        invoiceId,
        adjustedById,
      },
    });

    // Create event for credit application
    await createEvent({
      eventType: 'CREDIT_APPLIED_TO_INVOICE',
      resourceType: 'INVOICE',
      resourceId: invoiceId,
      severity: 'INFO',
      metadata: {
        adjustmentId: creditAdjustment.id,
        customerId,
        invoiceId,
        amount,
        newInvoiceStatus: updatedInvoice.status,
        remainingCredit: updatedCustomer.creditBalance,
      },
    });

    return { 
      creditAdjustment, 
      newBalance: updatedCustomer.creditBalance,
      updatedInvoice,
    };
  });
}

export async function getCreditHistory(
  customerId: string, 
  options?: {
    limit?: number;
    offset?: number;
    types?: string[];
    startDate?: Date;
    endDate?: Date;
  }
) {
  const { limit = 10, offset = 0, types, startDate, endDate } = options || {};

  const where: any = { customerId };

  if (types && types.length > 0) {
    where.type = { in: types };
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [adjustments, total] = await Promise.all([
    prisma.creditAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            status: true,
          },
        },
        adjustedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.creditAdjustment.count({ where }),
  ]);

  return {
    data: adjustments,
    meta: {
      total,
      limit,
      offset,
    },
  };
} 