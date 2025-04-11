import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    timestamp: Date;
  }>;
}

interface PerformanceMetrics {
  timestamp: Date;
  requests: {
    total: number;
    success: number;
    failed: number;
    averageLatency: number;
  };
  database: {
    queries: number;
    slowQueries: number;
    averageLatency: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  externalServices: Record<string, {
    requests: number;
    errors: number;
    averageLatency: number;
  }>;
}

interface MonitoringData {
  health: SystemHealth;
  metrics: PerformanceMetrics;
  timestamp: Date;
}

export function MonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/monitoring');
        if (!response.ok) {
          throw new Error('Failed to fetch monitoring data');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading monitoring data...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return <div>No monitoring data available</div>;
  }

  const { health, metrics } = data;

  return (
    <div className="space-y-4">
      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Badge
              variant={
                health.status === 'healthy'
                  ? 'success'
                  : health.status === 'degraded'
                  ? 'warning'
                  : 'destructive'
              }
            >
              {health.status.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {format(new Date(data.timestamp), 'PPpp')}
            </span>
          </div>
          <div className="space-y-4">
            {health.checks.map((check) => (
              <div key={check.name} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{check.name}</p>
                  {check.message && (
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  )}
                </div>
                <Badge
                  variant={
                    check.status === 'healthy'
                      ? 'success'
                      : check.status === 'degraded'
                      ? 'warning'
                      : 'destructive'
                  }
                >
                  {check.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="external">External Services</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Request Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Total Requests</p>
                  <p className="text-2xl font-bold">{metrics.requests.total}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Average Latency</p>
                  <p className="text-2xl font-bold">{metrics.requests.averageLatency.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Error Rate</p>
                  <p className="text-2xl font-bold">
                    {((metrics.requests.failed / metrics.requests.total) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle>Database Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Total Queries</p>
                  <p className="text-2xl font-bold">{metrics.database.queries}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Slow Queries</p>
                  <p className="text-2xl font-bold">{metrics.database.slowQueries}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Average Latency</p>
                  <p className="text-2xl font-bold">{metrics.database.averageLatency.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Error Rate</p>
                  <p className="text-2xl font-bold">
                    {((metrics.database.errors / metrics.database.queries) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache">
          <Card>
            <CardHeader>
              <CardTitle>Cache Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Hit Rate</p>
                  <p className="text-2xl font-bold">{(metrics.cache.hitRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Cache Size</p>
                  <p className="text-2xl font-bold">{(metrics.cache.size / 1024 / 1024).toFixed(1)}MB</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Hits</p>
                  <p className="text-2xl font-bold">{metrics.cache.hits}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Misses</p>
                  <p className="text-2xl font-bold">{metrics.cache.misses}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Cache Hit Rate</span>
                  <span>{(metrics.cache.hitRate * 100).toFixed(1)}%</span>
                </div>
                <Progress value={metrics.cache.hitRate * 100} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card>
            <CardHeader>
              <CardTitle>External Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(metrics.externalServices).map(([service, data]) => (
                  <div key={service} className="space-y-2">
                    <div className="flex justify-between">
                      <p className="font-medium capitalize">{service}</p>
                      <Badge variant={data.errors > 0 ? 'destructive' : 'default'}>
                        {data.errors} errors
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Requests</p>
                        <p className="text-lg font-semibold">{data.requests}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Average Latency</p>
                        <p className="text-lg font-semibold">{data.averageLatency.toFixed(0)}ms</p>
                      </div>
                    </div>
                    <Progress
                      value={(data.errors / data.requests) * 100}
                      className="h-1"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 