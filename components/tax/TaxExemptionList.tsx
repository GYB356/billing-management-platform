import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTaxRate } from '@/lib/utils/tax-calculations';

interface TaxExemption {
  id: string;
  customer: {
    name: string;
  };
  taxRate: {
    name: string;
    rate: number;
  };
  startDate: Date;
  endDate: Date | null;
  reason: string | null;
}

interface TaxExemptionListProps {
  exemptions: TaxExemption[];
  onDelete: (id: string) => Promise<void>;
}

export function TaxExemptionList({
  exemptions,
  onDelete,
}: TaxExemptionListProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Tax Rate</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exemptions.map((exemption) => (
            <TableRow key={exemption.id}>
              <TableCell>{exemption.customer.name}</TableCell>
              <TableCell>
                {exemption.taxRate.name} ({formatTaxRate(exemption.taxRate.rate)})
              </TableCell>
              <TableCell>
                {format(new Date(exemption.startDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                {exemption.endDate
                  ? format(new Date(exemption.endDate), 'MMM d, yyyy')
                  : 'No end date'}
              </TableCell>
              <TableCell>
                {exemption.reason ? (
                  <span className="text-sm text-muted-foreground">
                    {exemption.reason}
                  </span>
                ) : (
                  <Badge variant="secondary">No reason provided</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(exemption.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 