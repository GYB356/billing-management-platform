// filepath: /workspaces/billing-management-platform/app/admin/dashboard/page.tsx

import React from 'react';
import { Chart } from 'react-chartjs-2';

const AdminDashboard = () => {
  const data = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
    datasets: [
      {
        label: 'Revenue',
        data: [65, 59, 80, 81, 56, 55, 40],
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.4)',
        borderColor: 'rgba(75,192,192,1)',
      },
    ],
  };

  const options = {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <Chart type="line" data={data} options={options} />
    </div>
  );
};

export default AdminDashboard;