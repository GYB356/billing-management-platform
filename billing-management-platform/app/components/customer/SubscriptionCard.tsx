'use client';

import { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import { format } from "date-fns";

interface Subscription {
  id: string;
  planName: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
}

export default function SubscriptionCard() {
  const { data: sub, mutate } = useSWR<Subscription>("/api/customer/subscription");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await axios.post("/api/customer/subscription/cancel");
      await mutate(); // Refresh the data without a full page reload
    } catch (err) {
      console.error("Error canceling subscription:", err);
      setError("Failed to cancel subscription. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMMM d, yyyy");
  };

  return (
    <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Your Subscription</h2>
      
      {sub ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-medium">{sub.planName}</p>
              <p className="text-sm text-gray-500">
                Status: <span className={`font-medium ${sub.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>{sub.status}</span>
              </p>
            </div>
            {sub.status === "active" && !sub.cancelAtPeriodEnd && (
              <button 
                onClick={cancelSubscription} 
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Processing..." : "Cancel Subscription"}
              </button>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Current period ends: {formatDate(sub.currentPeriodEnd)}</p>
            {sub.cancelAtPeriodEnd && (
              <p className="text-amber-600 mt-1">
                Your subscription will be canceled at the end of the current billing period.
              </p>
            )}
            {sub.trialEndsAt && (
              <p className="text-blue-600 mt-1">
                Trial ends: {formatDate(sub.trialEndsAt)}
              </p>
            )}
          </div>
          
          {error && (
            <div className="mt-2 p-3 bg-red-50 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      )}
    </div>
  );
} 