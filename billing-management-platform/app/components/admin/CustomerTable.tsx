'use client';

import useSWR from "swr";
import Link from "next/link";
import React from 'react';

interface Customer {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  plan: string;
}

export default function CustomerTable() {
  const { data, error, isLoading } = useSWR<Customer[]>("/api/admin/customers");

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-red-600">Failed to load customer data</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Customers</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Plan</th>
              <th className="py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((cust) => (
              <tr key={cust.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{cust.name}</td>
                <td className="py-3 px-4">{cust.email}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cust.status)}`}>
                    {cust.status}
                  </span>
                </td>
                <td className="py-3 px-4">{cust.plan}</td>
                <td className="py-3 px-4">
                  <Link 
                    href={`/admin/customer/${cust.id}`} 
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 