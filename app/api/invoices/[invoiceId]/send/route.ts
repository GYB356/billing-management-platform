import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InvoiceService } from '@/lib/invoice';
import { z } from 'zod';

interface RouteParams {
  params: {
    invoiceId: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = params;
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if invoice exists and user has permission
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
      },
    });
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    // Only allow admins to send invoices
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can send invoices' }, { status: 403 });
    }
    
    // Ensure invoice is in DRAFT status
    if (invoice.status !== 'DRAFT') {
      return NextResponse.json({ 
        error: 'Only draft invoices can be sent' 
      }, { status: 400 });
    }
    
    // Parse request body for optional parameters
    const requestBody = await req.json().catch(() => ({}));
    
    const sendInvoiceSchema = z.object({
      emailSubject: z.string().optional(),
      emailBody: z.string().optional(),
      ccEmails: z.array(z.string().email()).optional(),
      bccEmails: z.array(z.string().email()).optional(),
      sendCopyToSelf: z.boolean().optional(),
    }).optional();
    
    const validationResult = sendInvoiceSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: validationResult.error.format() 
      }, { status: 400 });
    }
    
    const emailOptions = validationResult.data || {};
    
    // Generate invoice PDF
    const pdfBuffer = await InvoiceService.generateInvoice(
      invoiceId, 
      invoice.metadata?.templateOptions || {}
    );
    
    // Default email subject and body if not provided
    const defaultSubject = `Invoice #${invoice.number} from Your Company`;
    const defaultBody = `
Dear ${invoice.organization.name},

Please find attached your invoice #${invoice.number} for the amount of ${invoice.amount} ${invoice.currency}.

The invoice is due on ${new Date(invoice.dueDate).toLocaleDateString()}.

Thank you for your business.

Regards,
Your Company
    `.trim();
    
    // Send email with invoice PDF attachment
    // This is a placeholder - you would implement your email sending logic here
    // using a service like SendGrid, Mailgun, etc.
    
    // For example:
    // await emailService.sendEmail({
    //   to: invoice.organization.email,
    //   from: 'billing@yourcompany.com',
    //   subject: emailOptions.emailSubject || defaultSubject,
    //   text: emailOptions.emailBody || defaultBody,
    //   attachments: [
    //     {
    //       content: pdfBuffer.toString('base64'),
    //       filename: `Invoice-${invoice.number}.pdf`,
    //       type: 'application/pdf',
    //       disposition: 'attachment'
    //     }
    //   ],
    //   cc: emailOptions.ccEmails,
    //   bcc: emailOptions.bccEmails,
    // });
    
    // For now, we'll just log the email details
    console.log('Email would be sent with:', {
      to: invoice.organization.email,
      subject: emailOptions.emailSubject || defaultSubject,
      body: emailOptions.emailBody || defaultBody,
      hasAttachment: !!pdfBuffer,
      cc: emailOptions.ccEmails,
      bcc: emailOptions.bccEmails,
      sendCopyToSelf: emailOptions.sendCopyToSelf,
    });
    
    // Update invoice status to SENT
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'SENT',
        metadata: {
          ...invoice.metadata,
          lastSent: new Date().toISOString(),
          sentBy: session.user.id,
        },
      },
    });
    
    // Log the event
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'INVOICE_SENT',
        resourceId: invoiceId,
        resourceType: 'INVOICE',
        details: {
          invoiceNumber: invoice.number,
          organizationId: invoice.organizationId,
          amount: invoice.amount,
          currency: invoice.currency,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      invoice: {
        id: updatedInvoice.id,
        status: updatedInvoice.status,
      },
    });
    
  } catch (error) {
    console.error('Error sending invoice:', error);
    return NextResponse.json({ 
      error: 'Failed to send invoice', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 