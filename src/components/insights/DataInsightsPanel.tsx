import React from 'react';
import { Card, List, Typography, Tooltip, Progress } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useDataInsights } from '../../hooks/useDataInsights';

const { Text, Title } = Typography;

interface DataInsightsPanelProps {
  data: any[];
  selectedMetrics: string[];
}

export const DataInsightsPanel: React.FC<DataInsightsPanelProps> = ({ data, selectedMetrics }) => {
  const { insights, loading } = useDataInsights(data, selectedMetrics);

  return (
    <Card title="Data Insights" loading={loading}>
      <List
        dataSource={insights}
        renderItem={(insight) => (
          <List.Item>
            <List.Item.Meta
              avatar={insight.icon}
              title={
                <Space>
                  {insight.title}
                  <Tooltip title={insight.description}>
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>{insight.summary}</Text>
                  <Progress 
                    percent={insight.confidence} 
                    size="small" 
                    status={insight.confidence > 70 ? "success" : "warning"} 
                  />
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
