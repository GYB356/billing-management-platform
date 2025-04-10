import { NextRequest, NextResponse } from 'next/server';
import { PayPalService } from '@/lib/paypal';
import { auth } from '@/lib/auth';

const paypalService = new PayPalService();

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = params;
    const result = await paypalService.captureOrder(orderId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('PayPal capture failed:', error);
    return NextResponse.json(
      { error: 'Failed to capture PayPal payment' },
      { status: 500 }
    );
  }
}