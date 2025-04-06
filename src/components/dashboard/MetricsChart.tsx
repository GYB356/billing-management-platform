import React from 'react';
import { Line } from '@ant-design/plots';
import { Card } from 'antd';
import { MetricsData } from '../../types/metrics';

interface MetricsChartProps {
  data: MetricsData[];
  selectedMetrics: string[];
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ data, selectedMetrics }) => {
  const config = {
    data: data.flatMap(item => 
      selectedMetrics.map(metric => ({
        date: item.date,
        value: item[metric],
        metric: metric
      }))
    ),
    xField: 'date',
    yField: 'value',
    seriesField: 'metric',
    yAxis: {
      label: {
        formatter: (v: string) => `${v}`
      }
    },
    tooltip: {
      showMarkers: false
    },
    point: {
      size: 4,
      shape: 'circle'
    }
  };

  return (
    <Card title="Metrics Trends">
      <Line {...config} />
    </Card>
  );
};
