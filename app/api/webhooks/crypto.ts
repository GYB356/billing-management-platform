import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// BitPay webhook handler
async function handleBitPay(req: NextRequest) {
  const payload = await req.json();
  const signature = req.headers.get('x-signature') || '';
  const bitpaySecret = process.env.BITPAY_WEBHOOK_SECRET;
  
  if (!bitpaySecret) {
    console.error('BitPay webhook secret not configured');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  // Verify signature
  const hmac = crypto.createHmac('sha256', bitpaySecret);
  const computedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  
  if (computedSignature !== signature) {
    console.error('Invalid BitPay webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process the payment
  try {
    const { status, orderId, price, currency } = payload;
    
    if (status === 'confirmed' || status === 'complete') {
      // Update order status in database
      await updateOrderStatus(orderId, 'paid', {
        processor: 'bitpay',
        amount: price,
        currency,
        transactionId: payload.id
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ status: 'received' });
  } catch (error) {
    console.error('Error processing BitPay webhook:', error);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

// Wyre webhook handler
async function handleWyre(req: NextRequest) {
  const payload = await req.json();
  const signature = req.headers.get('x-wyre-signature') || '';
  const wyreSecret = process.env.WYRE_WEBHOOK_SECRET;
  
  if (!wyreSecret) {
    console.error('Wyre webhook secret not configured');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  // Verify signature
  const hmac = crypto.createHmac('sha256', wyreSecret);
  const computedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  
  if (computedSignature !== signature) {
    console.error('Invalid Wyre webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process the payment
  try {
    if (payload.type === 'TRANSFER_COMPLETE') {
      const { orderId, destAmount, destCurrency, transferId } = payload.transfer;
      
      // Update order status in database
      await updateOrderStatus(orderId, 'paid', {
        processor: 'wyre',
        amount: destAmount,
        currency: destCurrency,
        transactionId: transferId
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ status: 'received' });
  } catch (error) {
    console.error('Error processing Wyre webhook:', error);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

// Helper function to update order status
async function updateOrderStatus(
  orderId: string, 
  status: string, 
  paymentDetails: {
    processor: string;
    amount: number;
    currency: string;
    transactionId: string;
  }
) {
  // This would connect to your database
  // For now, just log the update
  console.log(`Updating order ${orderId} to status ${status} with payment details:`, paymentDetails);
  // Implement database update logic here
}

export async function POST(req: NextRequest) {
  const processor = req.nextUrl.searchParams.get('processor')?.toLowerCase();
  
  switch (processor) {
    case 'bitpay':
      return handleBitPay(req);
    case 'wyre':
      return handleWyre(req);
    default:
      return NextResponse.json({ error: 'Unknown processor' }, { status: 400 });
  }
} 