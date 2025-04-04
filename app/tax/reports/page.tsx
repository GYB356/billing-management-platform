'use client';

import { useState } from 'react';
import { TaxReportForm } from '@/components/tax/TaxReportForm';
import { TaxReportDisplay } from '@/components/tax/TaxReportDisplay';
import { TaxManagementContentSkeleton } from '@/components/tax/TaxManagementContentSkeleton';
import { generateReport } from './actions';
import { downloadTaxReportCSV } from '@/lib/utils/tax-report-export';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { TaxRate, TaxReport } from '@/types/tax';

export default function TaxReportsPage() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTaxRates, setIsLoadingTaxRates] = useState(true);

  useEffect(() => {
    async function fetchTaxRates() {
      try {
        const response = await fetch('/api/tax/rates');
        const data = await response.json();
        setTaxRates(data);
      } catch (error) {
        console.error('Failed to fetch tax rates:', error);
      } finally {
        setIsLoadingTaxRates(false);
      }
    }

    fetchTaxRates();
  }, []);

  const handleGenerateReport = async (data: {
    startDate: Date;
    endDate: Date;
    taxRateIds: string[];
  }) => {
    try {
      setIsLoading(true);
      const generatedReport = await generateReport({
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        taxRateIds: data.taxRateIds,
      });
      setReport(generatedReport);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    
    const filename = `tax-report-${format(new Date(report.period.startDate), 'yyyy-MM-dd')}-${format(new Date(report.period.endDate), 'yyyy-MM-dd')}.csv`;
    downloadTaxReportCSV(report, filename);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tax Reports</h1>
        <p className="text-muted-foreground">
          Generate and view tax reports for your organization
        </p>
      </div>

      {isLoadingTaxRates ? (
        <TaxManagementContentSkeleton />
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Generate Report</h2>
            <TaxReportForm taxRates={taxRates} onSubmit={handleGenerateReport} />
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Report Preview</h2>
              {report && (
                <Button onClick={handleExportCSV} variant="outline">
                  Export CSV
                </Button>
              )}
            </div>
            {isLoading ? (
              <TaxManagementContentSkeleton />
            ) : (
              <TaxReportDisplay
                report={report || {
                  period: {
                    startDate: new Date().toISOString(),
                    endDate: new Date().toISOString(),
                  },
                  taxTotals: [],
                  summary: {
                    totalTaxAmount: 0,
                    totalInvoices: 0,
                  },
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
} 