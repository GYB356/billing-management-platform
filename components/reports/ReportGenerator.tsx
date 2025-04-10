'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';

export function ReportGenerator() {
  const [reportType, setReportType] = useState('revenue');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)),
    end: new Date(),
  });
  const [format, setFormat] = useState('json');

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', reportType, dateRange],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports?type=${reportType}&startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`
      );
      if (!res.ok) throw new Error('Failed to generate report');
      return res.json();
    },
  });

  const downloadReport = async () => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Alert type="error" message="Failed to generate report" />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Generate Report
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="revenue">Revenue</option>
                <option value="expenses">Expenses</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Range
              </label>
              <DateRangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <Button onClick={downloadReport}>Download Report</Button>
          </div>
        </div>
      </Card>

      {/* Preview Report Data */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Report Preview
          </h3>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </Card>
    </div>
  );
}