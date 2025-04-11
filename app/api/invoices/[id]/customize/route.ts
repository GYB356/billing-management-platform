import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateInvoiceAccess } from '@/lib/validation';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new NextResponse('Invoice ID is required', { status: 400 });
    }

    const hasAccess = await validateInvoiceAccess(session, id);
    if (!hasAccess) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    const customization = await request.json();
    
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        customization: {
          ...invoice.customization,
          ...customization,
        },
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Error customizing invoice:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}