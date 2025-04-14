import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface MetricData {
  timestamp: string;
  value: number;
}

interface AnomalyData {
  timestamp: string;
  value: number;
  isAnomaly: boolean;
  score: number;
}

interface TrendData {
  slope: number;
  intercept: number;
  rSquared: number;
  forecast: number[];
  confidenceInterval: [number, number];
}

interface MetricVisualizationProps {
  metricName: string;
  startTime?: Date;
  endTime?: Date;
}

export const MetricVisualization: React.FC<MetricVisualizationProps> = ({
  metricName,
  startTime,
  endTime,
}) => {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          metricName,
          ...(startTime && { startTime: startTime.toISOString() }),
          ...(endTime && { endTime: endTime.toISOString() }),
        });

        const response = await fetch(`/api/monitoring?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch monitoring data');
        }

        const data = await response.json();
        setMetrics(
          data.metrics.map((m: any) => ({
            timestamp: format(new Date(m.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            value: m.value,
          }))
        );
        setAnomalies(
          data.anomalies.map((a: any) => ({
            timestamp: format(new Date(a.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            value: a.value,
            isAnomaly: a.isAnomaly,
            score: a.score,
          }))
        );
        setTrend(data.trend);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [metricName, startTime, endTime]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const chartData = metrics.map((metric) => {
    const anomaly = anomalies.find((a) => a.timestamp === metric.timestamp);
    return {
      ...metric,
      anomaly: anomaly?.isAnomaly ? metric.value : null,
      anomalyScore: anomaly?.score,
    };
  });

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">{metricName}</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => format(new Date(value), 'HH:mm')}
          />
          <YAxis />
          <Tooltip
            labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss')}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#8884d8"
            name="Metric Value"
          />
          <Line
            type="monotone"
            dataKey="anomaly"
            stroke="#ff0000"
            name="Anomaly"
            dot={{ fill: '#ff0000' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {trend && (
        <div className="mt-4">
          <h3 className="text-lg font-medium">Trend Analysis</h3>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p>Slope: {trend.slope.toFixed(4)}</p>
              <p>R-squared: {(trend.rSquared * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p>Confidence Interval:</p>
              <p>
                [{trend.confidenceInterval[0].toFixed(2)}, {trend.confidenceInterval[1].toFixed(2)}]
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 