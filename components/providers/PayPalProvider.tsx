'use client';

import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useEffect, useState } from 'react';

const initialOptions = {
    "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
    currency: "USD",
    intent: "capture"
};

export default function PayPalProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <PayPalScriptProvider options={initialOptions}>
            {children}
        </PayPalScriptProvider>
    );
}