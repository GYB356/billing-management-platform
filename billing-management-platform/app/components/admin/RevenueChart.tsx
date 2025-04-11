'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import useSWR from "swr";
import React from 'react';

interface RevenueData {
  month: string;
  revenue: number;
}

export default function RevenueChart() {
  const { data, error, isLoading } = useSWR<RevenueData[]>("/api/admin/revenue");

  if (error) {
    return (
      <div className="bg-white p-4 rounded-xl shadow">
        <p className="text-red-600">Failed to load revenue data</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-xl shadow animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-[250px] bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-2">Revenue Trends</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis 
            dataKey="month" 
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6B7280' }}
          />
          <YAxis 
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6B7280' }}
          />
          <Tooltip 
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{ 
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '0.5rem'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            stroke="#2563eb" 
            strokeWidth={2}
            dot={{ fill: '#2563eb', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#2563eb' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 