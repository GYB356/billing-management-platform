import { MonitoringDashboard } from '@/components/monitoring/Dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Monitoring',
  description: 'Monitor system health and performance metrics',
};

export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">System Monitoring</h1>
      <MonitoringDashboard />
    </div>
  );
} 