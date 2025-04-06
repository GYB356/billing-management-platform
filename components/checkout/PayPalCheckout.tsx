'use client';

import { PayPalButtons } from "@paypal/react-paypal-js";
import { useState } from 'react';
import { toast } from 'sonner';

interface PayPalCheckoutProps {
    amount: number;
    currency?: string;
    onSuccess?: (details: any) => void;
    onError?: (error: any) => void;
}

export default function PayPalCheckout({ 
    amount, 
    currency = 'USD',
    onSuccess,
    onError 
}: PayPalCheckoutProps) {
    const [loading, setLoading] = useState(false);

    const createOrder = async () => {
        try {
            const response = await fetch('/api/payments/paypal/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    currency,
                }),
            });

            const order = await response.json();
            
            if (!response.ok) {
                throw new Error(order.error || 'Failed to create order');
            }

            return order.id;
        } catch (error) {
            console.error('Error creating PayPal order:', error);
            toast.error('Failed to create PayPal order');
            onError?.(error);
            throw error;
        }
    };

    const onApprove = async (data: any, actions: any) => {
        try {
            setLoading(true);
            
            const response = await fetch('/api/payments/paypal/capture-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    orderId: data.orderID,
                }),
            });

            const details = await response.json();
            
            if (!response.ok) {
                throw new Error(details.error || 'Failed to capture payment');
            }

            toast.success('Payment completed successfully');
            onSuccess?.(details);
            
            return details;
        } catch (error) {
            console.error('Error capturing PayPal order:', error);
            toast.error('Failed to process payment');
            onError?.(error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            {loading && (
                <div className="text-center mb-4 text-sm text-gray-500">
                    Processing payment...
                </div>
            )}
            <PayPalButtons
                style={{ layout: "vertical" }}
                createOrder={createOrder}
                onApprove={onApprove}
                onError={(err) => {
                    console.error('PayPal error:', err);
                    toast.error('PayPal encountered an error');
                    onError?.(err);
                }}
                disabled={loading}
            />
        </div>
    );
}