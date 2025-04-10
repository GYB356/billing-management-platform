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
} from 'lucide-react';

interface Subscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  plan: {
    id: string;
    name: string;
    description: string;
  };
  quantity: number;
  stripeSubscriptionId: string | null;
  latestInvoice?: {
    status: string;
    amountDue: number;
    currency: string;
    invoiceUrl: string;
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
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </span>
        );
      case 'trialing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Trial
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Past Due
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Canceled
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <PauseCircle className="h-3 w-3 mr-1" />
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
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

  const isActive = ['active', 'trialing'].includes(subscription.status.toLowerCase());
  const isPaused = subscription.status.toLowerCase() === 'paused';
  const isPastDue = subscription.status.toLowerCase() === 'past_due';
  const isCanceled = subscription.status.toLowerCase() === 'canceled';

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Subscription Details</h3>
            <p className="mt-1 text-sm text-gray-500">Your current subscription information</p>
          </div>
          <div>{getStatusBadge(subscription.status)}</div>
        </div>
      </div>

      {/* Content */}
<<<<<<< HEAD
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
        
=======
      <div className="px-4 py-5 sm:p-6">
        {/* Success/Error messages */}
>>>>>>> origin/main
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600 flex items-center">
              <XCircle className="h-4 w-4 mr-1" />
              {error}
            </p>
          </div>
        )}

        {/* Subscription info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan info */}
          <div>
            <h4 className="text-sm font-medium text-gray-500">Plan</h4>
            <p className="mt-1 text-lg font-semibold text-gray-900">{subscription.plan.name}</p>
            <p className="text-sm text-gray-500">{subscription.plan.description}</p>
            
            {subscription.quantity > 1 && (
              <p className="mt-1 text-sm text-gray-600">
                Quantity: {subscription.quantity}
              </p>
            )}
            
            {subscription.cancelAtPeriodEnd && isActive && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Your subscription will cancel at the end of the current billing period.
                </p>
              </div>
            )}
          </div>

          {/* Billing info */}
          <div>
            <h4 className="text-sm font-medium text-gray-500">Billing</h4>
            
            {subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date() && (
              <div className="mt-1 flex items-center">
                <Clock className="h-5 w-5 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Trial ends on {formatDate(subscription.trialEndsAt)}
                  </p>
                  <p className="text-xs text-gray-500">
                    You won't be charged until your trial ends
                  </p>
                </div>
              </div>
            )}
            
            <div className="mt-1 flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Current period: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>
            
            {subscription.latestInvoice && (
              <div className="mt-1 flex items-center">
                <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Last invoice: {formatAmount(subscription.latestInvoice.amountDue, subscription.latestInvoice.currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {subscription.latestInvoice.status}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Past due warning */}
        {isPastDue && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Payment failed</h3>
                <p className="mt-1 text-sm text-red-700">
                  Your last payment was unsuccessful. Please update your payment method to avoid service interruption.
                </p>
                <div className="mt-3">
                  <Link href="/dashboard/payment-methods" className="text-sm font-medium text-red-700 hover:text-red-600">
                    Update payment method <ArrowRight className="inline h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription actions */}
        {!confirmingCancel && (
          <div className="mt-6 flex flex-wrap gap-3">
            {isActive && (
              <>
                <Link
                  href="/dashboard/subscription/change"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Change Plan
                </Link>
                <button
                  type="button"
                  onClick={() => handlePauseSubscription()}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PauseCircle className="h-4 w-4 mr-1" />
                  Pause Subscription
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel Subscription
                </button>
              </>
            )}
            
            {isPaused && (
              <button
                type="button"
                onClick={() => handleResumeSubscription()}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Resume Subscription
              </button>
            )}
            
            {isPastDue && (
              <Link
                href="/dashboard/payment-methods"
                className="inline-flex items-center px-4 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry Payment
              </Link>
            )}
            
            {isCanceled && availablePlans && availablePlans.length > 0 && (
              <Link
                href="/dashboard/subscription/checkout"
                className="inline-flex items-center px-4 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Resubscribe
              </Link>
            )}
          </div>
        )}

        {/* Cancellation confirmation */}
        {confirmingCancel && (
          <div className="mt-6 border border-gray-200 rounded-md p-4">
            <h4 className="text-lg font-medium text-gray-900">Cancel your subscription</h4>
            <p className="mt-1 text-sm text-gray-500">
              We're sorry to see you go. Please let us know why you're canceling so we can improve our service.
            </p>
            
            <div className="mt-4">
              <label htmlFor="cancellation-reason" className="block text-sm font-medium text-gray-700">
                Reason for cancellation (optional)
              </label>
              <select
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">Select a reason</option>
                <option value="too_expensive">Too expensive</option>
                <option value="missing_features">Missing features</option>
                <option value="switched_to_competitor">Switched to another service</option>
                <option value="not_using">Not using the service</option>
                <option value="temporary">Just need to pause temporarily</option>
                <option value="other">Other reason</option>
              </select>
            </div>
            
            <div className="mt-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="cancel-immediately"
                    type="checkbox"
                    checked={cancelImmediately}
                    onChange={() => setCancelImmediately(!cancelImmediately)}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="cancel-immediately" className="text-sm font-medium text-gray-700">
                    Cancel immediately
                  </label>
                  <p className="text-xs text-gray-500">
                    If unchecked, your subscription will remain active until the end of the current billing period.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {loading ? 'Processing...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 