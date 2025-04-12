import { useState, useEffect } from 'react';
import logger from '@/lib/logger';

interface SystemMetrics {
  timestamp: number;
  memory: {
    total: number;
    free: number;
    usage: {
      heapTotal: number;
      heapUsed: number;
      external: number;
      rss: number;
    };
  };
  cpu: {
    load: number[];
    cores: number;
  };
  uptime: number;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource;

    const connectToMetrics = () => {
      try {
        eventSource = new EventSource('/api/metrics');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setMetrics(data);
            setError(null);
          } catch (err) {
            logger.error('Error parsing metrics data', err as Error);
            setError('Failed to parse metrics data');
          }
        };

        eventSource.onerror = (err) => {
          logger.error('EventSource failed', err as Error);
          setError('Connection to metrics failed');
          eventSource.close();
          
          // Attempt to reconnect after 5 seconds
          setTimeout(connectToMetrics, 5000);
        };
      } catch (err) {
        logger.error('Failed to connect to metrics', err as Error);
        setError('Failed to connect to metrics');
      }
    };

    connectToMetrics();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return { metrics, error };
}