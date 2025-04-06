import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Select, Grid, Spin, Button, Space, Radio } from 'antd';
import { DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { MetricsChart } from './MetricsChart';
import { MetricsSummary } from './MetricsSummary';
import { useMetricsData } from '../../hooks/useMetricsData';
import { AdvancedFilters } from './AdvancedFilters';
import { exportToCSV, exportToPDF } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;

export const AdvancedMetricsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    new Date()
  ]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['revenue', 'users']);
  const [filterView, setFilterView] = useState<'basic' | 'advanced'>('basic');
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');

  const { data, loading, error } = useMetricsData(dateRange);

  const handleExport = async () => {
    try {
      if (exportFormat === 'csv') {
        await exportToCSV(data, selectedMetrics);
      } else {
        await exportToPDF(data, selectedMetrics);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <div>Error loading metrics: {error.message}</div>;

  return (
    <div className="advanced-metrics-dashboard">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card>
          <Space split={true}>
            <RangePicker 
              onChange={(dates) => setDateRange([dates[0].toDate(), dates[1].toDate()])}
            />
            <Select
              mode="multiple"
              value={selectedMetrics}
              onChange={setSelectedMetrics}
              options={[
                { label: 'Revenue', value: 'revenue' },
                { label: 'Users', value: 'users' },
                { label: 'Transactions', value: 'transactions' }
              ]}
            />
            
            <Radio.Group value={filterView} onChange={(e) => setFilterView(e.target.value)}>
              <Radio.Button value="basic">Basic</Radio.Button>
              <Radio.Button value="advanced">Advanced</Radio.Button>
            </Radio.Group>

            <Space>
              <Select
                value={exportFormat}
                onChange={setExportFormat}
                options={[
                  { label: 'CSV', value: 'csv' },
                  { label: 'PDF', value: 'pdf' }
                ]}
                style={{ width: 100 }}
              />
              <Button 
                icon={<DownloadOutlined />}
                onClick={handleExport}
              >
                Export
              </Button>
            </Space>
          </Space>
        </Card>

        {filterView === 'advanced' && (
          <AdvancedFilters 
            onApply={(filters) => console.log('Applied filters:', filters)} 
          />
        )}

        <Grid gutter={[16, 16]}>
          <MetricsSummary 
            data={data} 
            selectedMetrics={selectedMetrics}
            comparisonMode={comparisonMode}
          />
          <MetricsChart 
            data={data} 
            selectedMetrics={selectedMetrics}
            comparisonMode={comparisonMode}
          />
        </Grid>
      </Space>
    </div>
  );
};
