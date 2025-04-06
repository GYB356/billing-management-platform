import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { MetricsData } from '../../types/metrics';
import { calculateMetricsSummary } from '../../utils/metricsUtils';

interface MetricsSummaryProps {
  data: MetricsData[];
  selectedMetrics: string[];
}

export const MetricsSummary: React.FC<MetricsSummaryProps> = ({ data, selectedMetrics }) => {
  const summary = calculateMetricsSummary(data, selectedMetrics);

  return (
    <Row gutter={16}>
      {selectedMetrics.map(metric => (
        <Col span={8} key={metric}>
          <Card>
            <Statistic
              title={metric.charAt(0).toUpperCase() + metric.slice(1)}
              value={summary[metric].total}
              precision={2}
              suffix={metric === 'revenue' ? '$' : ''}
            />
            <div className="metric-change">
              {summary[metric].percentChange}% from previous period
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};
