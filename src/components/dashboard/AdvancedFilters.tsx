import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Space, DatePicker, Tag, Badge, Modal } from 'antd';
import { trackUserActivity } from '../../utils/activityTracker';
import { AlertOutlined, ScheduleOutlined, FileTextOutlined } from '@ant-design/icons';

interface AdvancedFiltersProps {
  onApply: (filters: any) => void;
}

interface ReportConfigModalProps {
  visible: boolean;
  onCancel: () => void;
  filters: any;
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ visible, onCancel, filters }) => {
  return (
    <Modal
      title="Report Configuration"
      visible={visible}
      onCancel={onCancel}
      footer={null}
    >
      <Form layout="vertical">
        <Form.Item name="template" label="Report Template">
          <Select
            options={[
              { label: 'Summary Report', value: 'summary' },
              { label: 'Detailed Report', value: 'detailed' }
            ]}
          />
        </Form.Item>
        <Form.Item name="schedule" label="Schedule">
          <Select
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' }
            ]}
          />
        </Form.Item>
        <Form.Item name="email" label="Email Delivery">
          <Input type="email" />
        </Form.Item>
        <Space>
          <Button type="primary">Generate</Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form>
    </Modal>
  );
};

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ onApply }) => {
  const [form] = Form.useForm();
  const [hasAnomalies, setHasAnomalies] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const handleApply = () => {
    const values = form.getFieldsValue();
    trackUserActivity('filter_applied', values);
    onApply(values);
  };

  const handleReset = () => {
    form.resetFields();
    trackUserActivity('filter_reset');
  };

  return (
    <>
      <Card 
        title="Advanced Filters" 
        extra={
          <Space>
            <Tag color="blue">Active Filters: 0</Tag>
            {hasAnomalies && (
              <Badge status="warning" text="Anomalies Detected" />
            )}
            <Button 
              icon={<FileTextOutlined />}
              onClick={() => setReportModalVisible(true)}
            >
              Generate Report
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Space wrap>
            <Form.Item name="category" label="Category">
              <Select
                style={{ width: 200 }}
                options={[
                  { label: 'Subscription', value: 'subscription' },
                  { label: 'One-time', value: 'onetime' }
                ]}
              />
            </Form.Item>
            <Form.Item name="threshold" label="Value Threshold">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select
                style={{ width: 200 }}
                mode="multiple"
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Cancelled', value: 'cancelled' }
                ]}
              />
            </Form.Item>
            <Form.Item name="dateRange" label="Custom Date Range">
              <DatePicker.RangePicker />
            </Form.Item>
            <Space>
              <Button type="primary" onClick={handleApply}>
                Apply Filters
              </Button>
              <Button onClick={handleReset}>
                Reset
              </Button>
            </Space>
          </Space>
        </Form>
      </Card>

      <ReportConfigModal
        visible={reportModalVisible}
        onCancel={() => setReportModalVisible(false)}
        filters={form.getFieldsValue()}
      />
    </>
  );
};
