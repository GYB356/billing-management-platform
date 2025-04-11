import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { generateInvoicePDF } from '@/lib/services/invoice-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view invoices
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:invoices'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const invoiceId = params.id;
    
    // Check if the invoice exists and user has access
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceId);
    
    // Return the PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate invoice PDF' },
      { status: 500 }
    );
  }
} 