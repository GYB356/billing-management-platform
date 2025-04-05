import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PaymentRetryService } from '@/lib/services/payment-retry-service';
import { createEvent } from '@/lib/events';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin or system role
    if (!['ADMIN', 'SYSTEM'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Initialize retry service
    const retryService = new PaymentRetryService();

    // Process all scheduled retries
    await retryService.processScheduledRetries();

    // Log event
    await createEvent({
      eventType: 'PAYMENT_RETRY_PROCESSING_COMPLETED',
      resourceType: 'SYSTEM',
      resourceId: 'payment-retry-processor',
      metadata: {
        processedAt: new Date().toISOString()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing payment retries:', error);
    return NextResponse.json(
      { error: 'Failed to process payment retries' },
      { status: 500 }
    );
  }
}