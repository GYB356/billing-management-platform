import { NextRequest, NextResponse } from 'next/server';
import { checkUsageAlerts } from '@/lib/usage/alerts';

// This endpoint should be called by a cron job service (e.g., Vercel Cron)
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await checkUsageAlerts();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error checking usage alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check usage alerts' },
      { status: 500 }
    );
  }
}
