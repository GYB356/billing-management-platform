import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatisticalAnalysisProps {
  data: {
    mean: number;
    median: number;
    stdDev: number;
    variance: number;
  };
}

export function StatisticalAnalysis({ data }: StatisticalAnalysisProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Statistical Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium">Mean</h4>
            <p className="text-2xl font-bold">{data.mean.toFixed(2)}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Median</h4>
            <p className="text-2xl font-bold">{data.median.toFixed(2)}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Standard Deviation</h4>
            <p className="text-2xl font-bold">{data.stdDev.toFixed(2)}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Variance</h4>
            <p className="text-2xl font-bold">{data.variance.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}