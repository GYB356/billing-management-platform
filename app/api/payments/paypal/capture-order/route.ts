import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();

        const response = await fetch(
            `${process.env.PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${Buffer.from(
                        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
                    ).toString('base64')}`,
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to capture PayPal order');
        }

        // Here you would typically:
        // 1. Update your database with the payment status
        // 2. Send confirmation emails
        // 3. Update subscription status if applicable
        // 4. Generate invoice

        return NextResponse.json(data);
    } catch (error) {
        console.error('PayPal capture error:', error);
        return NextResponse.json(
            { error: 'Failed to capture PayPal payment' },
            { status: 500 }
        );
    }
}