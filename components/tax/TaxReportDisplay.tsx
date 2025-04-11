import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaxReport } from '@/types/tax';
import { formatCurrency } from '@/lib/utils/format';

interface TaxReportDisplayProps {
  report: TaxReport;
}

export function TaxReportDisplay({ report }: TaxReportDisplayProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">
                {format(new Date(report.period.startDate), 'PPP')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium">
                {format(new Date(report.period.endDate), 'PPP')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.taxTotals.map((taxTotal) => (
              <div
                key={taxTotal.taxRate.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div>
                  <p className="font-medium">{taxTotal.taxRate.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {taxTotal.taxRate.rate}% - {taxTotal.invoiceCount} invoices
                  </p>
                </div>
                <p className="font-medium">
                  {formatCurrency(taxTotal.totalAmount)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{report.summary.totalInvoices}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tax Amount</p>
              <p className="text-2xl font-bold">
                {formatCurrency(report.summary.totalTaxAmount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}