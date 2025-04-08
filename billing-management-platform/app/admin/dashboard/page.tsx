'use client';

import { Suspense } from "react";
import AdminOverview from "@/components/admin/AdminOverview";
import RevenueChart from "@/components/admin/RevenueChart";
import CustomerTable from "@/components/admin/CustomerTable";
import SystemSettings from "@/components/admin/SystemSettings";

function LoadingCard() {
  return (
    <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Export Data
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              New Report
            </button>
          </div>
        </div>

        <Suspense fallback={<LoadingCard />}>
          <AdminOverview />
        </Suspense>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<LoadingCard />}>
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>
          </Suspense>

          <Suspense fallback={<LoadingCard />}>
            <div className="lg:col-span-2">
              <CustomerTable />
            </div>
          </Suspense>
        </div>

        <Suspense fallback={<LoadingCard />}>
          <SystemSettings />
        </Suspense>
      </div>
    </div>
  );
} 