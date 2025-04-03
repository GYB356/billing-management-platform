import { NextResponse } from 'next/server';
import { processUsageRecords } from '@/lib/usage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5-minute timeout for long-running job

export async function GET(request: Request) {
  try {
    // Simple auth check via a predefined key
    const url = new URL(request.url);
    const authKey = url.searchParams.get('key');
    
    // This should be a securely stored environment variable
    if (authKey !== process.env.CRON_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Process and report usage to Stripe
    await processUsageRecords();
    
    return NextResponse.json({ 
      success: true,
      message: 'Usage records processed successfully', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Error processing usage records:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process usage records', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
} 