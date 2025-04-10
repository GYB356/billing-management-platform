import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TaxReportDisplay } from './TaxReportDisplay';
import { cn } from '@/lib/utils';

interface TaxReportGeneratorProps {
  organizationId: string;
}

export function TaxReportGenerator({ organizationId }: TaxReportGeneratorProps) {
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    if (!fromDate || !toDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/tax/reports?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to generate tax report');
      }
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Error generating tax report:', error);
      setError('Failed to generate tax report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[240px] justify-start text-left font-normal',
                !fromDate && 'text-muted-foreground'
              )}
            >
              {fromDate ? format(fromDate, 'PPP') : 'Select start date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={setFromDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[240px] justify-start text-left font-normal',
                !toDate && 'text-muted-foreground'
              )}
            >
              {toDate ? format(toDate, 'PPP') : 'Select end date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={setToDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button onClick={generateReport} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Report'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {report && <TaxReportDisplay report={report} />}
    </div>
  );
} 