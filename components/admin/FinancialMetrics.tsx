import React, { useEffect, useState } from 'react';
import axios from 'axios';

const FinancialMetrics = () => {
  const [metrics, setMetrics] = useState({ mrr: 0, arr: 0, churnRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await axios.get('/api/admin/analytics/metrics');
        setMetrics(response.data);
      } catch (err) {
        setError('Failed to load financial metrics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) return <p>Loading financial metrics...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Financial Metrics</h1>
      <ul>
        <li>Monthly Recurring Revenue (MRR): ${metrics.mrr}</li>
        <li>Annual Recurring Revenue (ARR): ${metrics.arr}</li>
        <li>Churn Rate: {metrics.churnRate.toFixed(2)}%</li>
      </ul>
    </div>
  );
};

export default FinancialMetrics;