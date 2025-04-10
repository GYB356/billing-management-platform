'use client';

import { useState } from "react";
import useSWR from "swr";
import axios from "axios";
import { TaxRate } from "@prisma/client";

interface TaxRateForm {
  country: string;
  region: string;
  rate: number;
}

export default function AdminTaxes() {
  const { data: rates, mutate } = useSWR<TaxRate[]>("/api/admin/tax-rates");
  const [form, setForm] = useState<TaxRateForm>({ country: "", region: "", rate: 0 });

  const addRate = async () => {
    try {
      await axios.post("/api/admin/tax-rates", form);
      await mutate(); // Refresh the data without a full page reload
    } catch (error) {
      console.error('Error adding tax rate:', error);
      alert('Failed to add tax rate');
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Tax Rates Management</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rates?.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{r.country}</td>
                <td className="px-6 py-4 whitespace-nowrap">{r.region || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{(r.rate * 100).toFixed(2)}%</td>
                <td className="px-6 py-4 whitespace-nowrap">{r.isDefault ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Add New Tax Rate</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            placeholder="Country"
            className="border rounded px-3 py-2"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <input
            placeholder="Region (optional)"
            className="border rounded px-3 py-2"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
          <input
            placeholder="Rate (%)"
            type="number"
            step="0.01"
            className="border rounded px-3 py-2"
            value={form.rate * 100}
            onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) / 100 })}
          />
          <button
            onClick={addRate}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Add Tax Rate
          </button>
        </div>
      </div>
    </div>
  );
} 