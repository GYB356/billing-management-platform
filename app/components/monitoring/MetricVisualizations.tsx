import React from 'react';
import {
  LineChart,
  BarChart,
  ScatterChart,
  AreaChart,
  Line,
  Bar,
  Scatter,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

interface MetricData {
  timestamp: string;
  value: number;
  anomaly?: number;
  anomalyScore?: number;
}

interface VisualizationProps {
  data: MetricData[];
  type: 'line' | 'bar' | 'scatter' | 'area' | 'heatmap';
  title: string;
  height?: number;
}

export const MetricVisualization: React.FC<VisualizationProps> = ({
  data,
  type,
  title,
  height = 400,
}) => {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
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
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
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
            <Bar dataKey="value" fill="#8884d8" name="Metric Value">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.anomaly ? '#ff0000' : '#8884d8'}
                />
              ))}
            </Bar>
          </BarChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
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
            <Scatter
              name="Metric Value"
              dataKey="value"
              fill="#8884d8"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.anomaly ? '#ff0000' : '#8884d8'}
                />
              ))}
            </Scatter>
          </ScatterChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
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
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.3}
              name="Metric Value"
            />
            <Area
              type="monotone"
              dataKey="anomaly"
              stroke="#ff0000"
              fill="#ff0000"
              fillOpacity={0.3}
              name="Anomaly"
            />
          </AreaChart>
        );

      case 'heatmap':
        const timeSlots = Array.from({ length: 24 }, (_, i) => i);
        const days = Array.from(
          { length: 7 },
          (_, i) => format(new Date().setDate(new Date().getDate() - i), 'EEE')
        ).reverse();

        const heatmapData = timeSlots.map((hour) => {
          const dayData: Record<string, number> = { hour };
          days.forEach((day) => {
            const value = data.find(
              (d) =>
                format(new Date(d.timestamp), 'HH') === String(hour).padStart(2, '0') &&
                format(new Date(d.timestamp), 'EEE') === day
            )?.value || 0;
            dayData[day] = value;
          });
          return dayData;
        });

        return (
          <div className="heatmap-container">
            <div className="heatmap-header">
              {days.map((day) => (
                <div key={day} className="heatmap-day">
                  {day}
                </div>
              ))}
            </div>
            <div className="heatmap-body">
              {timeSlots.map((hour) => (
                <div key={hour} className="heatmap-row">
                  <div className="heatmap-hour">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {days.map((day) => {
                    const value = heatmapData.find((d) => d.hour === hour)?.[day] || 0;
                    const maxValue = Math.max(...data.map((d) => d.value));
                    const intensity = Math.min(1, value / maxValue);
                    return (
                      <div
                        key={`${hour}-${day}`}
                        className="heatmap-cell"
                        style={{
                          backgroundColor: `rgba(136, 132, 216, ${intensity})`,
                        }}
                        title={`${day} ${String(hour).padStart(2, '0')}:00 - ${value}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Styles for heatmap
const styles = `
.heatmap-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heatmap-header {
  display: flex;
  gap: 4px;
  padding-left: 60px;
}

.heatmap-day {
  flex: 1;
  text-align: center;
  font-weight: 500;
}

.heatmap-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heatmap-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.heatmap-hour {
  width: 60px;
  text-align: right;
  padding-right: 8px;
  font-size: 0.875rem;
}

.heatmap-cell {
  flex: 1;
  height: 20px;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.heatmap-cell:hover {
  opacity: 0.8;
}
`;

export const MetricVisualizationStyles = () => (
  <style jsx global>
    {styles}
  </style>
); 