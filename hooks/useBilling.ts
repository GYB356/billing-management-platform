import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  dueDate: string;
}

export function useBilling() {
  const { session } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchBillingData();
    }
  }, [session]);

  const fetchBillingData = async () => {
    try {
      const [balanceResponse, invoicesResponse] = await Promise.all([
        fetch('/api/customer/balance'),
        fetch('/api/customer/invoices?limit=5'),
      ]);

      if (!balanceResponse.ok) throw new Error('Failed to fetch balance');
      if (!invoicesResponse.ok) throw new Error('Failed to fetch invoices');

      const balanceData = await balanceResponse.json();
      const invoicesData = await invoicesResponse.json();

      setBalance(balanceData.balance);
      setRecentInvoices(invoicesData.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/customer/invoices/${invoiceId}/download`);
      if (!response.ok) throw new Error('Failed to download invoice');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download invoice');
    }
  };

  return {
    balance,
    recentInvoices,
    loading,
    error,
    downloadInvoice,
    refresh: fetchBillingData,
  };
}
