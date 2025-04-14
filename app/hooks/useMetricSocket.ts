import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface MetricUpdate {
  metrics: Array<{
    timestamp: string;
    value: number;
  }>;
  anomalies: Array<{
    timestamp: string;
    value: number;
    isAnomaly: boolean;
    score: number;
  }>;
  trend: {
    slope: number;
    intercept: number;
    rSquared: number;
    forecast: number[];
    confidenceInterval: [number, number];
  };
  timestamp: string;
}

export const useMetricSocket = (metricName: string, interval = 5000) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<MetricUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000');

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    newSocket.on('error', (err) => {
      console.error('WebSocket error:', err);
      setError(err.message);
    });

    newSocket.on('update', (update: MetricUpdate) => {
      setData(update);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('subscribe', { metricName, interval });
    }

    return () => {
      if (socket) {
        socket.emit('unsubscribe', { metricName });
      }
    };
  }, [socket, isConnected, metricName, interval]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  return {
    data,
    error,
    isConnected,
    reconnect,
  };
}; 
import { io, Socket } from 'socket.io-client';

interface MetricUpdate {
  metrics: Array<{
    timestamp: string;
    value: number;
  }>;
  anomalies: Array<{
    timestamp: string;
    value: number;
    isAnomaly: boolean;
    score: number;
  }>;
  trend: {
    slope: number;
    intercept: number;
    rSquared: number;
    forecast: number[];
    confidenceInterval: [number, number];
  };
  timestamp: string;
}

export const useMetricSocket = (metricName: string, interval = 5000) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<MetricUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000');

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    newSocket.on('error', (err) => {
      console.error('WebSocket error:', err);
      setError(err.message);
    });

    newSocket.on('update', (update: MetricUpdate) => {
      setData(update);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('subscribe', { metricName, interval });
    }

    return () => {
      if (socket) {
        socket.emit('unsubscribe', { metricName });
      }
    };
  }, [socket, isConnected, metricName, interval]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  return {
    data,
    error,
    isConnected,
    reconnect,
  };
};