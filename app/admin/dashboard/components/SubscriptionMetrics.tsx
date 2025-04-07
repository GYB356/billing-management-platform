'use client';

import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PlanDistribution {
  name: string;
  value: number;
  color: string;
}

interface ChurnData {
  period: string;
  value: number;
}

interface SubscriptionMetricsProps {
  planDistribution: PlanDistribution[];
  churnData: ChurnData[];
  totalSubscriptions: number;
  activeTrials: number;
}

export default function SubscriptionMetrics({
  planDistribution,
  churnData,
  totalSubscriptions,
  activeTrials,
}: SubscriptionMetricsProps) {
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={planDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {planDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} subscribers`, 'Count']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {planDistribution.map((plan) => (
              <div key={plan.name} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: plan.color }}
                />
                <span className="text-sm text-gray-600">{plan.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Overview</h3>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-500">Total Subscriptions</p>
            <p className="text-2xl font-semibold">{totalSubscriptions}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Trials</p>
            <p className="text-2xl font-semibold">{activeTrials}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Trial Conversion Rate</p>
            <p className="text-2xl font-semibold">
              {((totalSubscriptions / (totalSubscriptions + activeTrials)) * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Average Churn Rate (Last 3 Months)</p>
            <p className="text-2xl font-semibold">
              {(churnData.reduce((acc, curr) => acc + curr.value, 0) / churnData.length).toFixed(1)}%
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
