'use client';

import { useState } from 'react';

type CouponValidationResponse = {
  valid: boolean;
  discount: {
    type: 'percentage' | 'fixed';
    value: number;
    currency?: string;
  };
  planId?: string;
  message?: string;
};

type CouponRedemptionProps = {
  planId?: string;
  onApplyCoupon: (couponData: CouponValidationResponse) => void;
  className?: string;
};

export default function CouponRedemption({
  planId,
  onApplyCoupon,
  className = '',
}: CouponRedemptionProps) {
  const [couponCode, setCouponCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/coupons', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: couponCode.trim(),
          planId
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to validate coupon');
      }
      
      if (!data.valid) {
        setError(data.message || 'Invalid coupon code');
        setAppliedCoupon(null);
        return;
      }
      
      setAppliedCoupon(data);
      onApplyCoupon(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while validating the coupon');
      setAppliedCoupon(null);
    } finally {
      setIsLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setError(null);
    onApplyCoupon({ valid: false, discount: { type: 'percentage', value: 0 } });
  };

  return (
    <div className={`rounded-md border border-gray-200 p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Do you have a coupon?</h3>
      
      {!appliedCoupon ? (
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Enter coupon code"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Applying...' : 'Apply'}
          </button>
        </form>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-green-800 font-medium">{couponCode}</span>
              <p className="text-green-700 text-sm mt-1">
                {appliedCoupon.discount.type === 'percentage'
                  ? `${appliedCoupon.discount.value}% discount`
                  : `${appliedCoupon.discount.currency || '$'}${appliedCoupon.discount.value} discount`}
              </p>
            </div>
            <button
              onClick={removeCoupon}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Remove
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-sm text-red-600">{error}</div>
      )}
    </div>
  );
} 