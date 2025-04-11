import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateInvoice } from '@/lib/invoice';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionId = params.id;
    const pdfBuffer = await generateInvoice(subscriptionId);

    // Create response with PDF buffer
    const response = new NextResponse(pdfBuffer);

    // Set headers for PDF download
    response.headers.set('Content-Type', 'application/pdf');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="invoice-${Date.now()}.pdf"`
    );
    response.headers.set('Content-Length', pdfBuffer.length.toString());

    return response;
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
} 