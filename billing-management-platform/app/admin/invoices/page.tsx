"use client";
import { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import { formatCurrency } from "@/lib/invoice/calculations";

export default function AdminInvoices() {
  const { data, error, isLoading, mutate } = useSWR("/api/admin/invoices");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await axios.post("/api/invoice/mark-paid", { invoiceId });
      mutate();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !reason || !amount) return;

    try {
      await axios.post("/api/invoice/refund", {
        invoiceId: selectedInvoice,
        reason,
        amount: parseFloat(amount) * 100 // Convert to cents
      });
      setSelectedInvoice(null);
      setReason("");
      setAmount("");
      mutate();
    } catch (error) {
      console.error("Error creating refund:", error);
    }
  };

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">Error loading invoices</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Invoices</h1>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">PDF</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((invoice: any) => (
              <tr key={invoice.id} className="border-b">
                <td className="p-3">{invoice.number}</td>
                <td className="p-3">{invoice.customer.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    invoice.status === "paid" ? "bg-green-100 text-green-800" :
                    invoice.status === "unpaid" ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="p-3">{formatCurrency(invoice.amountDue / 100)}</td>
                <td className="p-3">
                  {invoice.pdfUrl ? (
                    <a 
                      href={invoice.pdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  ) : "N/A"}
                </td>
                <td className="p-3">
                  {invoice.status === "unpaid" && (
                    <button
                      onClick={() => handleMarkPaid(invoice.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-2"
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedInvoice(invoice.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Refund
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Refund Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create Refund</h2>
            <form onSubmit={handleRefund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={3}
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 