import React from 'react';
import { PaymentMethodManager } from '@/components/billing/PaymentMethodManager';

export const metadata = {
  title: 'Payment Methods - Billing Platform',
  description: 'Manage your payment methods for your account',
};

export default function PaymentMethodsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payment Methods</h1>
        <p className="text-gray-600 mt-2">
          Manage your payment methods for your account
        </p>
      </div>
      
      <PaymentMethodManager />
    </div>
  );
} 