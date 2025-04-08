"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Event, EventSeverity } from "@/lib/types";
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ArrowPathIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { getAuditLogs } from '@/lib/logging/audit';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';

const SEVERITY_COLORS = {
  INFO: "bg-blue-100 text-blue-800",
  WARNING: "bg-yellow-100 text-yellow-800",
  ERROR: "bg-red-100 text-red-800",
  CRITICAL: "bg-purple-100 text-purple-800",
};

const SEVERITY_ICONS = {
  INFO: <InformationCircleIcon className="w-5 h-5 text-blue-600" />,
  WARNING: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />,
  ERROR: <ExclamationCircleIcon className="w-5 h-5 text-red-600" />,
  CRITICAL: <ShieldExclamationIcon className="w-5 h-5 text-purple-600" />,
};

export default async function AuditLogsPage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const page = Number(searchParams.page) || 1;
  const limit = 50;
  const userId = searchParams.userId;
  const action = searchParams.action;
  const startDate = searchParams.startDate ? new Date(searchParams.startDate) : undefined;
  const endDate = searchParams.endDate ? new Date(searchParams.endDate) : undefined;

  const { logs, total, hasMore } = await getAuditLogs({
    userId,
    action: action as any,
    startDate,
    endDate,
    limit,
    offset: (page - 1) * limit
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Audit Logs</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">User ID</label>
              <Input
                type="text"
                name="userId"
                defaultValue={userId}
                placeholder="Filter by user ID"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Action</label>
              <Input
                type="text"
                name="action"
                defaultValue={action}
                placeholder="Filter by action"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <DateRangePicker
                from={startDate}
                to={endDate}
                onSelect={({ from, to }) => {
                  // Handle date selection
                }}
              />
            </div>
          </div>
          <Button type="submit">Apply Filters</Button>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target ID
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(log.createdAt), 'PPpp')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {log.user.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {log.user.email}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.action}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {log.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.targetId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-700">
          Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
        </div>
        <div className="space-x-2">
          <Button
            disabled={page === 1}
            onClick={() => {
              // Handle previous page
            }}
          >
            Previous
          </Button>
          <Button
            disabled={!hasMore}
            onClick={() => {
              // Handle next page
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
} 