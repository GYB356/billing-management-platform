'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Transaction {
  amount: number;
  created: number;
  type: string;
}

interface RevenueChartProps {
  transactions: Transaction[];
}

export default function RevenueChart({ transactions }: RevenueChartProps) {
  const chartRef = useRef<ChartJS>(null);

  // Process transactions to get daily revenue
  const dailyRevenue = transactions.reduce((acc, transaction) => {
    if (transaction.type === 'charge') {
      const date = new Date(transaction.created * 1000).toLocaleDateString();
      acc[date] = (acc[date] || 0) + transaction.amount / 100;
    }
    return acc;
  }, {} as Record<string, number>);

  // Sort dates and prepare data for chart
  const sortedDates = Object.keys(dailyRevenue).sort();
  const revenueData = sortedDates.map(date => dailyRevenue[date]);

  const data = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Daily Revenue',
        data: revenueData,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Revenue Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `$${value.toFixed(2)}`,
        },
      },
    },
  };

  return (
    <div className="h-[300px]">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
} 