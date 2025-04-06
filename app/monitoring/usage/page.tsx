import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import UsageMetricsDashboard from '@/components/monitoring/UsageMetricsDashboard';
import { Card } from '@/components/ui';

export const metadata = {
  title: 'Usage Monitoring',
  description: 'Monitor and analyze usage metrics across your organization'
};

async function getMetricNames() {
  const metrics = await prisma.customMetric.findMany({
    distinct: ['name'],
    select: { name: true }
  });
  return metrics.map(m => m.name);
}

export default async function UsageMonitoringPage() {
  const metricNames = await getMetricNames();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Usage Monitoring</h1>
        <p className="text-gray-600">
          Monitor and analyze usage patterns across your organization
        </p>
      </div>

      <div className="grid gap-6">
        <Suspense
          fallback={
            <Card>
              <div className="h-96 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            </Card>
          }
        >
          <UsageMetricsDashboard metricNames={metricNames} />
        </Suspense>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Monitoring Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Aggregation Interval
                  </label>
                  <select 
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="5m">5 minutes</option>
                    <option value="15m">15 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="1d">1 day</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Alert Thresholds
                  </label>
                  <div className="mt-1 flex items-center space-x-4">
                    <input
                      type="number"
                      placeholder="Warning"
                      className="block w-24 px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    />
                    <input
                      type="number"
                      placeholder="Critical"
                      className="block w-24 px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Usage Insights</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Active Metrics</h3>
                  <p className="mt-1 text-2xl font-semibold">{metricNames.length}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Aggregation Status</h3>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Running
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}