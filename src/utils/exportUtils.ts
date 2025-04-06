import { MetricsData } from '../types/metrics';

export const exportToCSV = async (data: MetricsData[], selectedMetrics: string[]) => {
  const headers = ['Date', ...selectedMetrics];
  const csvContent = [
    headers.join(','),
    ...data.map(row => [
      row.date,
      ...selectedMetrics.map(metric => row[metric])
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `metrics-export-${new Date().toISOString()}.csv`;
  link.click();
};

export const exportToPDF = async (data: MetricsData[], selectedMetrics: string[]) => {
  // Implement PDF export logic using a library like jsPDF
  console.log('PDF export not implemented yet');
};
