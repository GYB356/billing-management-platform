import { useState, useEffect } from 'react';
import { MetricsData } from '../types/metrics';
import { fetchMetricsData } from '../services/metricsService';

export const useMetricsData = (dateRange: [Date, Date]) => {
  const [data, setData] = useState<MetricsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchMetricsData(dateRange);
        setData(response);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange]);

  return { data, loading, error };
};
