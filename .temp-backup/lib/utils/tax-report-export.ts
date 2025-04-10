import { format } from 'date-fns';
import { TaxReport } from '@/types/tax';
import { formatCurrency } from './format';

export function generateTaxReportCSV(report: TaxReport): string {
  const rows: string[] = [];

  // Add header
  rows.push('Tax Report');
  rows.push(`Period: ${format(new Date(report.period.startDate), 'PPP')} - ${format(new Date(report.period.endDate), 'PPP')}`);
  rows.push('');

  // Add summary
  rows.push('Summary');
  rows.push(`Total Invoices,${report.summary.totalInvoices}`);
  rows.push(`Total Tax Amount,${formatCurrency(report.summary.totalTaxAmount)}`);
  rows.push('');

  // Add tax breakdown
  rows.push('Tax Breakdown');
  rows.push('Tax Rate,Rate,Invoice Count,Amount');
  report.taxTotals.forEach((taxTotal) => {
    rows.push(
      `${taxTotal.taxRate.name},${taxTotal.taxRate.rate}%,${taxTotal.invoiceCount},${formatCurrency(taxTotal.totalAmount)}`
    );
  });

  return rows.join('\n');
}

export function downloadTaxReportCSV(report: TaxReport, filename: string) {
  const csv = generateTaxReportCSV(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 