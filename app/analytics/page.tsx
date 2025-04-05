import { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics/Dashboard';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'View business metrics and insights',
};

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>
      <AnalyticsDashboard />
    </div>
  );
}