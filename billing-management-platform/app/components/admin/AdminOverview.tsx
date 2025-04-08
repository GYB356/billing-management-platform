'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';

interface OverviewCard {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  icon?: string;
}

interface OverviewData {
  cards: OverviewCard[];
  lastUpdated: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function AdminOverview() {
  const { data, error, isLoading } = useSWR<OverviewData>('/api/admin/overview');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl">
        Failed to load overview data
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <span className="text-sm text-gray-500">
          Last updated: {new Date(data?.lastUpdated || '').toLocaleString()}
        </span>
      </div>

      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.cards.map((item) => (
          <motion.div
            key={item.label}
            variants={item}
            className={`bg-white rounded-xl shadow p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedCard === item.label ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedCard(selectedCard === item.label ? null : item.label)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm text-gray-600">{item.label}</h3>
                <p className="text-xl font-semibold mt-1">{item.value}</p>
              </div>
              {item.icon && (
                <span className="text-gray-400 text-xl">{item.icon}</span>
              )}
            </div>

            {item.change !== undefined && (
              <div className={`mt-2 text-sm ${getTrendColor(item.trend)}`}>
                {getTrendIcon(item.trend)} {Math.abs(item.change)}%
              </div>
            )}

            {selectedCard === item.label && item.description && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 text-sm text-gray-500 border-t pt-2"
              >
                {item.description}
              </motion.div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}