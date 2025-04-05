import { Metadata } from 'next';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Analytics Dashboard',
  description: 'View your business metrics and performance',
};

export default async function AnalyticsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      <AnalyticsDashboard />
    </div>
  );
}