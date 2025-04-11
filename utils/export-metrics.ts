import { jsPDF } from 'jspdf';

export function exportMetricsAsCSV(metrics: any[], filename: string = 'metrics.csv') {
  const headers = Object.keys(metrics[0]);
  const rows = metrics.map(metric => headers.map(header => metric[header]));

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportMetricsAsPDF(metrics: any[], filename: string = 'metrics.pdf') {
  const doc = new jsPDF();
  const headers = Object.keys(metrics[0]);
  const rows = metrics.map(metric => headers.map(header => metric[header]));

  doc.autoTable({ head: [headers], body: rows });
  doc.save(filename);
}