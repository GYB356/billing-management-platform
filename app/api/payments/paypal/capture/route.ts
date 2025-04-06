import { NextRequest, NextResponse } from 'next/server';
import { PayPalService } from '@/lib/paypal';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const payerId = searchParams.get('PayerID');

    if (!token || !payerId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/billing?error=missing_paypal_params`
      );
    }

    const paypalService = new PayPalService();
    const result = await paypalService.capturePayment(token);

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/billing?success=true&paymentId=${result.paymentId}`
    );
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/billing?error=payment_failed`
    );
  }
}