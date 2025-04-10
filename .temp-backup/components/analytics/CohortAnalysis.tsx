'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, HelpCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CohortData {
  cohorts: {
    date: string;
    initialCount: number;
    retentionByPeriod: number[];
  }[];
  periods: string[];
}

interface CohortAnalysisProps {
  initialTimeframe?: string;
  initialMetric?: 'retention' | 'revenue' | 'churn';
}

export default function CohortAnalysis({
  initialTimeframe = 'monthly',
  initialMetric = 'retention',
}: CohortAnalysisProps) {
  const [cohortData, setCohortData] = useState<CohortData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>(initialTimeframe);
  const [metric, setMetric] = useState<string>(initialMetric);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCohortData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/analytics/cohorts?timeframe=${timeframe}&metric=${metric}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch cohort data');
        }
        
        const data = await response.json();
        setCohortData(data);
      } catch (err) {
        console.error('Error fetching cohort data:', err);
        setError((err as Error).message || 'An error occurred while fetching data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCohortData();
  }, [timeframe, metric]);

  // Function to render cell color based on retention rate
  const getCellColor = (value: number) => {
    if (metric === 'churn') {
      // For churn, red is bad (high churn)
      if (value <= 5) return 'bg-green-100 text-green-800';
      if (value <= 10) return 'bg-green-50 text-green-700';
      if (value <= 20) return 'bg-yellow-50 text-yellow-700';
      if (value <= 30) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    } else {
      // For retention or revenue, green is good (high values)
      if (value >= 90) return 'bg-green-100 text-green-800';
      if (value >= 70) return 'bg-green-50 text-green-700';
      if (value >= 50) return 'bg-yellow-50 text-yellow-700';
      if (value >= 30) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
  };

  const formatValue = (value: number) => {
    if (metric === 'revenue') {
      return `$${value.toFixed(0)}`;
    }
    return `${value.toFixed(1)}%`;
  };

  // Export cohort data as CSV
  const handleExport = () => {
    if (!cohortData) return;

    // Create CSV content
    let csvContent = 'Cohort,Initial Count,';
    
    // Add period headers
    cohortData.periods.forEach((period, index) => {
      csvContent += `Period ${index + 1},`;
    });
    csvContent += '\n';

    // Add data rows
    cohortData.cohorts.forEach(cohort => {
      csvContent += `${cohort.date},${cohort.initialCount},`;
      
      // Add retention values
      cohort.retentionByPeriod.forEach(value => {
        csvContent += `${value},`;
      });
      
      csvContent += '\n';
    });

    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `cohort-analysis-${metric}-${timeframe}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cohort Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-60">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cohort Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 text-red-800 p-4 rounded-md">
            <p>Error: {error}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center">
          <CardTitle>Cohort Analysis</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>
                  Cohort analysis tracks groups of customers who started in the same time period, 
                  showing how their behavior changes over time. Each row represents a cohort, 
                  and each column shows their metrics for subsequent periods.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retention">Retention</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="churn">Churn</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={handleExport}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {cohortData && cohortData.cohorts.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted">Cohort</TableHead>
                  <TableHead className="bg-muted text-right">Size</TableHead>
                  {cohortData.periods.map((period, index) => (
                    <TableHead key={index} className="bg-muted text-right">
                      {period}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortData.cohorts.map((cohort, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{cohort.date}</TableCell>
                    <TableCell className="text-right">{cohort.initialCount}</TableCell>
                    {cohort.retentionByPeriod.map((value, periodIndex) => (
                      <TableCell
                        key={periodIndex}
                        className={`text-right ${getCellColor(value)}`}
                      >
                        {formatValue(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-60 text-gray-500">
            <p>No cohort data available for the selected timeframe.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 