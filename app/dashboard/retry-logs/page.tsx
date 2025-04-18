'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { CheckCircleIcon, XCircleIcon } from 'lucide-react';

interface RetryLog {
  id: string;
  invoiceId: string;
  userId: string;
  status: string;
  attempts: number;
  createdAt: string;
}

export default function RetryLogDashboard() {
  const [logs, setLogs] = useState<RetryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get('/api/retry/logs');
        setLogs(res.data);
      } catch (err) {
        console.error('Failed to fetch retry logs');
        toast({
          title: 'Error',
          description: 'Failed to fetch retry logs',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const exportToCSV = () => {
    const csvRows = [
      ['Invoice ID', 'User ID', 'Status', 'Attempts', 'Date'],
      ...logs.map((log) => [
        log.invoiceId,
        log.userId,
        log.status,
        log.attempts.toString(),
        new Date(log.createdAt).toLocaleString(),
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'retry_logs.csv';
    a.click();
  };

  const retryInvoice = async (invoiceId: string) => {
    try {
      const res = await axios.post('/api/retry/manual', { invoiceId });
      toast({
        title: 'Retry triggered',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span>{res.data.message || 'Invoice retry was successful.'}</span>
          </div>
        ),
      });
    } catch (err: any) {
      toast({
        title: 'Retry failed',
        description: (
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-red-500" />
            <span>{err?.response?.data?.message || 'Unable to retry invoice.'}</span>
          </div>
        ),
        variant: 'destructive',
      });
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.status.toLowerCase().includes(filter.toLowerCase()) ||
      log.userId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold">🔁 Retry Logs</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Filter by status or user..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64"
          />
          <Button onClick={exportToCSV}>Export CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 overflow-auto">
          {loading ? (
            <p>Loading logs...</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Invoice ID</TableHeaderCell>
                  <TableHeaderCell>User ID</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Attempts</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.invoiceId}</TableCell>
                    <TableCell>{log.userId}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'success' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.attempts}</TableCell>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => retryInvoice(log.invoiceId)}>
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 