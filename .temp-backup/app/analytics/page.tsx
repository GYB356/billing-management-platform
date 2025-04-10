import { Metadata } from 'next';
import { EnhancedAnalyticsDashboard } from '@/components/analytics/EnhancedAnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Analytics | Billing Management Platform',
  description: 'Advanced analytics and insights for your subscription business',
};

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto py-8">
      <EnhancedAnalyticsDashboard />
    </div>
  );
}