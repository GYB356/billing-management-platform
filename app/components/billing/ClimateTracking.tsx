import React, { useState, useEffect } from 'react';

interface UsageData {
  apiCalls: number;
  dataTransferGB: number;
  computeHours: number;
  storageGB: number;
}

interface CarbonData {
  totalEmissions: number; // in kg CO2e
  breakdown: {
    category: string;
    value: number;
    percentage: number;
  }[];
  offsetCost: number;
  currency: string;
}

interface ClimateTrackingProps {
  usageData: UsageData;
  onOffset: (amount: number) => Promise<boolean>;
  currency?: string;
}

export default function ClimateTracking({
  usageData,
  onOffset,
  currency = 'USD'
}: ClimateTrackingProps) {
  const [carbonData, setCarbonData] = useState<CarbonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffsetting, setIsOffsetting] = useState(false);
  const [offsetSuccess, setOffsetSuccess] = useState<boolean | null>(null);
  
  // Function to calculate carbon emissions (simplified model)
  // In a real app, you would call an API like Patch.io
  const calculateCarbon = (usage: UsageData): CarbonData => {
    // Emission factors (kg CO2e per unit)
    const factors = {
      apiCalls: 0.000004, // per API call
      dataTransfer: 0.052,  // per GB
      compute: 0.638,      // per hour
      storage: 0.007       // per GB per month
    };
    
    // Calculate emissions by category
    const apiEmissions = usage.apiCalls * factors.apiCalls;
    const dataEmissions = usage.dataTransferGB * factors.dataTransfer;
    const computeEmissions = usage.computeHours * factors.compute;
    const storageEmissions = usage.storageGB * factors.storage;
    
    const totalEmissions = apiEmissions + dataEmissions + computeEmissions + storageEmissions;
    
    // Generate breakdown
    const breakdown = [
      {
        category: 'API Calls',
        value: apiEmissions,
        percentage: (apiEmissions / totalEmissions) * 100
      },
      {
        category: 'Data Transfer',
        value: dataEmissions,
        percentage: (dataEmissions / totalEmissions) * 100
      },
      {
        category: 'Compute',
        value: computeEmissions,
        percentage: (computeEmissions / totalEmissions) * 100
      },
      {
        category: 'Storage',
        value: storageEmissions,
        percentage: (storageEmissions / totalEmissions) * 100
      }
    ];
    
    // Calculate offset cost ($10 per tonne CO2e, minimum $0.50)
    const offsetCost = Math.max(0.5, totalEmissions * 0.01);
    
    return {
      totalEmissions,
      breakdown,
      offsetCost,
      currency
    };
  };
  
  // Simulate API call to calculate carbon emissions
  useEffect(() => {
    setIsLoading(true);
    
    // Simulate network delay
    const timer = setTimeout(() => {
      const data = calculateCarbon(usageData);
      setCarbonData(data);
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [usageData]);
  
  // Handle offset button click
  const handleOffset = async () => {
    if (!carbonData) return;
    
    setIsOffsetting(true);
    try {
      const success = await onOffset(carbonData.offsetCost);
      setOffsetSuccess(success);
    } catch (error) {
      setOffsetSuccess(false);
      console.error('Failed to process offset:', error);
    } finally {
      setIsOffsetting(false);
    }
  };
  
  // Format number with 2 decimal places
  const formatNumber = (value: number) => {
    return value.toFixed(2);
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(value);
  };
  
  if (isLoading) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        <div className="text-center text-gray-500 mt-4">Calculating carbon footprint...</div>
      </div>
    );
  }
  
  if (!carbonData) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50">
        <div className="text-center text-gray-500">
          Unable to calculate carbon footprint at this time.
        </div>
      </div>
    );
  }
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-green-50 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-2">🌱</span>
          <h2 className="text-xl font-bold text-green-800">Carbon Footprint</h2>
        </div>
        
        <div className="mb-6">
          <div className="text-3xl font-bold text-green-700 mb-1">
            {formatNumber(carbonData.totalEmissions)} kg CO₂e
          </div>
          <div className="text-green-600">
            Estimated carbon emissions for your monthly usage
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg mb-6">
          <h3 className="font-medium mb-3">Emissions Breakdown</h3>
          
          {carbonData.breakdown.map((item) => (
            <div key={item.category} className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{item.category}</span>
                <span>{formatNumber(item.value)} kg CO₂e</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-white p-4 rounded-lg">
          <h3 className="font-medium mb-2">Offset Your Carbon Footprint</h3>
          <p className="text-sm text-gray-600 mb-4">
            Neutralize your carbon emissions by funding verified climate projects
            through Patch.io
          </p>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500">Cost to offset</div>
              <div className="text-xl font-bold">{formatCurrency(carbonData.offsetCost)}</div>
            </div>
            
            <button
              className={`px-4 py-2 rounded-md ${
                offsetSuccess
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              onClick={handleOffset}
              disabled={isOffsetting || offsetSuccess === true}
            >
              {isOffsetting ? 'Processing...' : 
               offsetSuccess === true ? 'Offset Confirmed ✓' : 
               'Offset Emissions'}
            </button>
          </div>
          
          {offsetSuccess === false && (
            <div className="text-sm text-red-500">
              There was an error processing your offset. Please try again.
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 bg-gray-50 border-t">
        <h3 className="font-medium mb-2">Usage Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">API Calls</div>
            <div>{usageData.apiCalls.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">Data Transfer</div>
            <div>{usageData.dataTransferGB.toLocaleString()} GB</div>
          </div>
          <div>
            <div className="text-gray-500">Compute</div>
            <div>{usageData.computeHours.toLocaleString()} hours</div>
          </div>
          <div>
            <div className="text-gray-500">Storage</div>
            <div>{usageData.storageGB.toLocaleString()} GB</div>
          </div>
        </div>
      </div>
    </div>
  );
} 