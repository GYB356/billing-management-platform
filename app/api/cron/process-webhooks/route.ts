import { NextResponse } from 'next/server';
import { processPendingWebhooks } from '@/lib/webhooks/processEvents';

// This should match your cron service's secret
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  try {
    // Verify the request is from your cron service
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await processPendingWebhooks();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in webhook processing cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 