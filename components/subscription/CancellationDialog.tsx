import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface CancellationDialogProps {
  subscription: {
    id: string;
    currentPeriodEnd: string;
  };
  onClose: () => void;
  onCanceled: () => void;
}

const CANCELLATION_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features' },
  { value: 'switched_to_competitor', label: 'Switched to another service' },
  { value: 'poor_experience', label: 'Poor experience' },
  { value: 'not_using', label: 'Not using the service enough' },
  { value: 'temporary', label: 'Temporary pause needed' },
  { value: 'other', label: 'Other reason' }
];

export default function CancellationDialog({
  subscription,
  onClose,
  onCanceled
}: CancellationDialogProps) {
  const [reason, setReason] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!reason) {
      setError('Please select a reason for cancellation');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          additionalFeedback,
          cancelImmediately
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      onCanceled();
    } catch (err: any) {
      setError(err.message || 'An error occurred while canceling your subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">Cancel Subscription</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              Why are you canceling?
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a reason</option>
              {CANCELLATION_REASONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">
              Additional feedback (optional)
            </label>
            <textarea
              id="feedback"
              rows={3}
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Please tell us more about why you're canceling..."
            />
          </div>

          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="cancelImmediately"
                type="checkbox"
                checked={cancelImmediately}
                onChange={(e) => setCancelImmediately(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="cancelImmediately" className="text-sm font-medium text-gray-700">
                Cancel immediately
              </label>
              <p className="text-sm text-gray-500">
                If unchecked, your subscription will remain active until{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto"
            >
              {loading ? 'Canceling...' : 'Confirm Cancellation'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="mt-3 sm:mt-0 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}