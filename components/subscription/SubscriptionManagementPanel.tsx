'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Calendar,
  ArrowRight,
  Clock,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

interface Subscription {
  id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
  startDate: string;
  endDate?: string;
  plan: {
    name: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
  };
  latestInvoice?: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    dueDate: string;
  };
}

interface Invoice {
  id: string;
  amountDue: number;
  currency: string;
  status: string;
  invoiceDate: string;
  dueDate?: string;
}

interface UsageRecord {
  id: string;
  featureId: number;
  quantity: number;
  recordedAt: string;
}

interface SubscriptionManagementPanelProps {
  subscription: Subscription;
  availablePlans?: any[]; // for upgrading/downgrading
  onRefresh?: () => void;
}

export default function SubscriptionManagementPanel({
  subscription,
  availablePlans,
  onRefresh,
}: SubscriptionManagementPanelProps) {
  const router = useRouter();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const response = await fetch(`/api/invoices?subscriptionId=${subscription.id}`);
        const data = await response.json();
        if (response.ok) {
          setInvoices(data.invoices);
        }
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
      }
    }

    async function fetchUsageRecords() {
      try {
        const response = await fetch(`/api/usage?subscriptionId=${subscription.id}`);
        const data = await response.json();
        if (response.ok) {
          setUsageRecords(data.usageRecords);
        }
      } catch (error) {
        console.error('Failed to fetch usage records:', error);
      }
    }

    fetchInvoices();
    fetchUsageRecords();
  }, [subscription.id]);

  // Format dates
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Format amount for display
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Get status badge
  const getStatusBadge = (status: Subscription['status']) => {
    const badges = {
      active: { color: 'bg-green-100 text-green-800', text: 'Active' },
      trialing: { color: 'bg-blue-100 text-blue-800', text: 'Trial' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', text: 'Past Due' },
      canceled: { color: 'bg-red-100 text-red-800', text: 'Canceled' },
      paused: { color: 'bg-gray-100 text-gray-800', text: 'Paused' },
    };
    
    return badges[status] || { color: 'bg-gray-100 text-gray-800', text: status };
  };

  const handleCancelSubscription = async () => {
    if (!subscription.id) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelAtPeriodEnd: !cancelImmediately,
          reason: cancellationReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      setSuccess(
        cancelImmediately
          ? 'Your subscription has been canceled successfully.'
          : 'Your subscription will be canceled at the end of the current billing period.'
      );
      setConfirmingCancel(false);

      // Refresh the subscription data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while canceling your subscription.');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseSubscription = async () => {
    if (!subscription.id) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to pause subscription');
      }

      setSuccess('Your subscription has been paused successfully.');

      // Refresh the subscription data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while pausing your subscription.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription.id) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resume subscription');
      }

      setSuccess('Your subscription has been resumed successfully.');

      // Refresh the subscription data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while resuming your subscription.');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = getStatusBadge(subscription.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Subscription Details</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
            {statusBadge.text}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-6 py-4">
        {/* Plan details */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Current Plan</h3>
          <div className="mt-2">
            <p className="text-lg font-semibold text-gray-900">{subscription.plan.name}</p>
            <p className="text-sm text-gray-600">
              {formatAmount(subscription.plan.price, subscription.plan.currency)}/{subscription.plan.interval}
            </p>
          </div>
        </div>
        
        {/* Billing details */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Billing Period</h3>
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Started: {formatDate(subscription.startDate)}
            </p>
            {subscription.endDate && (
              <p className="text-sm text-gray-600">
                Ends: {formatDate(subscription.endDate)}
              </p>
            )}
          </div>
        </div>
        
        {/* Latest invoice */}
        {subscription.latestInvoice && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500">Latest Invoice</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Amount: {formatAmount(subscription.latestInvoice.amount, subscription.latestInvoice.currency)}
              </p>
              <p className="text-sm text-gray-600">
                Due Date: {formatDate(subscription.latestInvoice.dueDate)}
              </p>
              <p className="text-sm text-gray-600">
                Status: {subscription.latestInvoice.status}
              </p>
            </div>
          </div>
        )}

        {/* Invoices Section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Invoices</h3>
          <ul className="mt-2 space-y-2">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="text-sm text-gray-600">
                <span>{new Date(invoice.invoiceDate).toLocaleDateString()} - </span>
                <span>{invoice.status} - </span>
                <span>{new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: invoice.currency,
                }).format(invoice.amountDue / 100)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Usage Records Section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Usage Records</h3>
          <ul className="mt-2 space-y-2">
            {usageRecords.map((record) => (
              <li key={record.id} className="text-sm text-gray-600">
                <span>Feature {record.featureId}: </span>
                <span>{record.quantity} units on </span>
                <span>{new Date(record.recordedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error}
            </p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              {success}
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="space-y-3">
          {/* Change plan button */}
          <button
            type="button"
            className="w-full flex items-center justify-center py-2 px-4 border border-indigo-600 rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={loading || subscription.status === 'canceled'}
          >
            Change Plan
          </button>
          
          {/* Pause/Resume button */}
          {subscription.status !== 'canceled' && (
            <button
              type="button"
              onClick={subscription.status === 'paused' ? handleResumeSubscription : handlePauseSubscription}
              disabled={loading}
              className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {subscription.status === 'paused' ? (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Resume Subscription
                </>
              ) : (
                <>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pause Subscription
                </>
              )}
            </button>
          )}
          
          {/* Cancel button */}
          {subscription.status !== 'canceled' && (
            <>
              {!confirmingCancel ? (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  disabled={loading}
                  className="w-full flex items-center justify-center py-2 px-4 border border-red-600 rounded-md shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Subscription
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">
                    Are you sure you want to cancel your subscription?
                  </p>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleCancelSubscription}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center py-2 px-4 border border-red-600 rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Yes, Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(false)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      No, Keep
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}