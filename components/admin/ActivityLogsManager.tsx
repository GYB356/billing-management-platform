import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  user: {
    name: string;
    email: string;
  };
}

export default function ActivityLogsManager() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');

  useEffect(() => {
    fetchLogs();
  }, [dateRange, filterAction, filterUser]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());
      if (filterAction) params.append('action', filterAction);
      if (filterUser) params.append('userId', filterUser);

      const response = await fetch(\`/api/admin/activity-logs?\${params}\`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = [
    'PAYMENT_PROCESSED',
    'SUBSCRIPTION_UPDATED',
    'INVOICE_GENERATED',
    'BILLING_SETTINGS_UPDATED',
    'TAX_RATE_MODIFIED',
    'CREDIT_APPLIED',
    'REFUND_ISSUED',
  ];

  const formatDateTime = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM d, yyyy HH:mm:ss');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Calendar
              mode="range"
              selected={dateRange ? { from: dateRange.from, to: dateRange.to } : undefined}
              onSelect={(range) => setDateRange(range as { from: Date; to: Date })}
              className="rounded-md border"
            />
            <Button
              variant="outline"
              onClick={() => {
                setDateRange(null);
                setFilterAction('');
                setFilterUser('');
              }}
            >
              Reset Filters
            </Button>
          </div>

          {/* Activity Log Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                      <TableCell>{log.user.name}</TableCell>
                      <TableCell>{log.action.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{log.resource}</TableCell>
                      <TableCell>
                        <pre className="text-xs">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}