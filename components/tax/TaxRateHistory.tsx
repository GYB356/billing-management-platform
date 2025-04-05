import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TaxRateHistory {
  id: string;
  name: string;
  rate: number;
  country: string;
  state?: string;
  city?: string;
  description?: string;
  isActive: boolean;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

interface TaxRateHistoryProps {
  taxRateId: string;
}

export function TaxRateHistory({ taxRateId }: TaxRateHistoryProps) {
  const [history, setHistory] = useState<TaxRateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [taxRateId, dateRange]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.from.toISOString());
        params.append('endDate', dateRange.to.toISOString());
      }

      const response = await fetch(
        `/api/tax-rates/${taxRateId}/history?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch tax rate history');
      }

      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching tax rate history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Rate History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Select date range"
          />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[60px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[150px]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No history found
                  </TableCell>
                </TableRow>
              ) : (
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.changedAt), 'PPp')}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.rate}%</TableCell>
                    <TableCell>
                      {[item.country, item.state, item.city]
                        .filter(Boolean)
                        .join(', ')}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>{item.changedBy}</TableCell>
                    <TableCell>{item.reason || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 