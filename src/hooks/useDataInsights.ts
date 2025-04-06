import { useState, useEffect } from 'react';
import { detectAnomalies, analyzePatterns } from '../utils/dataAnalysis';

export const useDataInsights = (data: any[], metrics: string[]) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateInsights = async () => {
      setLoading(true);
      try {
        const anomalies = await detectAnomalies(data, metrics);
        const patterns = await analyzePatterns(data, metrics);
        
        const combinedInsights = [
          ...anomalies.map(a => ({
            type: 'anomaly',
            title: `Anomaly Detected: ${a.metric}`,
            description: a.description,
            confidence: a.confidence,
            summary: `${a.value} (${a.deviation}% deviation)`,
          })),
          ...patterns.map(p => ({
            type: 'pattern',
            title: `Pattern Identified: ${p.name}`,
            description: p.description,
            confidence: p.confidence,
            summary: p.summary,
          }))
        ];

        setInsights(combinedInsights);
      } finally {
        setLoading(false);
      }
    };

    generateInsights();
  }, [data, metrics]);

  return { insights, loading };
};
