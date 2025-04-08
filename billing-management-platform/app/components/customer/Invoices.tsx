'use client';

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";

interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string;
}

export default function Invoices() {
  const { data: invoices, error: fetchError, isLoading } = useSWR<Invoice[]>("/api/customer/invoices");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'text-green-600 bg-green-50';
      case 'open':
        return 'text-blue-600 bg-blue-50';
      case 'void':
        return 'text-gray-600 bg-gray-50';
      case 'uncollectible':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (fetchError) {
    return (
      <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Invoice History</h2>
        <p className="text-red-600">Failed to load invoices</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
      <h2 className="text-xl font-semibold mb-6">Invoice History</h2>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex justify-between items-center p-4 border rounded-lg">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : invoices?.length ? (
        <div className="divide-y divide-gray-100">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-medium">Invoice #{inv.number}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{formatDate(inv.date)}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">{formatAmount(inv.amount, inv.currency)}</span>
                <a
                  href={inv.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                >
                  View PDF
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No invoices found</p>
      )}
    </div>
  );
} 