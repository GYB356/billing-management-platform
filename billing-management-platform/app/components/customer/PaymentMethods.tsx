'use client';

import { useState } from "react";
import useSWR from "swr";
import { loadStripe } from "@stripe/stripe-js";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export default function PaymentMethods() {
  const { data: paymentMethods, error: fetchError } = useSWR<PaymentMethod[]>("/api/customer/payment-methods");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePaymentMethod = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/customer/payment-method-link");
      
      if (!res.ok) {
        throw new Error('Failed to get payment update link');
      }
      
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("Error updating payment method:", err);
      setError("Failed to initiate payment method update. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return '💳 Visa';
      case 'mastercard':
        return '💳 Mastercard';
      case 'amex':
        return '💳 American Express';
      default:
        return '💳';
    }
  };

  if (fetchError) {
    return (
      <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Payment Methods</h2>
        <p className="text-red-600">Failed to load payment methods</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Payment Methods</h2>
        <button
          onClick={updatePaymentMethod}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Processing..." : "Update Payment Method"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      {paymentMethods ? (
        paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl" aria-hidden="true">
                    {getCardIcon(method.brand)}
                  </span>
                  <div>
                    <p className="font-medium">
                      {method.brand} •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-500">
                      Expires {method.expMonth}/{method.expYear}
                    </p>
                  </div>
                </div>
                {method.isDefault && (
                  <span className="text-sm text-green-600 font-medium">
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No payment methods found</p>
        )
      ) : (
        <div className="space-y-3">
          <div className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 