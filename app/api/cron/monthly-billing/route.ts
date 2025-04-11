import { NextRequest, NextResponse } from 'next/server';
import { processMonthlyBilling } from '@/lib/billing/monthly-billing';

export async function GET(req: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await processMonthlyBilling();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Monthly billing error:', error);
    return NextResponse.json(
      { error: 'Failed to process monthly billing' },
      { status: 500 }
    );
  }
}
