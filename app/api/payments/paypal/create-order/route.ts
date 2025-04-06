import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { amount, currency = 'USD' } = await req.json();

        const response = await fetch(`${process.env.PAYPAL_API_URL}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(
                    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
                ).toString('base64')}`,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        amount: {
                            currency_code: currency,
                            value: amount.toString(),
                        },
                    },
                ],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to create PayPal order');
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('PayPal order creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create PayPal order' },
            { status: 500 }
        );
    }
}