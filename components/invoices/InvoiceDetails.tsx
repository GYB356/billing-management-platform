'use client';

import { useQuery } from '@tanstack/react-query';

export function InvoiceDetails({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return res.json();
    }
  });
  
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!data) {
    return <div>No invoice found</div>;
  }

  return (
    <div>
      <h1>Invoice Details</h1>
      <p>Invoice ID: {data.id}</p>
      <p>Amount: {data.amount}</p>
      <p>Status: {data.status}</p>
    </div>
  );
}