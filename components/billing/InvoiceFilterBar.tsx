'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar, Search, Filter, X } from 'lucide-react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface InvoiceFilterBarProps {
  currencies: string[];
  currentFilters: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: string;
    maxAmount?: string;
    currency?: string;
    search?: string;
    page?: string;
    perPage?: string;
  };
}

export default function InvoiceFilterBar({
  currencies,
  currentFilters,
}: InvoiceFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Local state for filters
  const [status, setStatus] = useState<string[]>(
    currentFilters.status ? currentFilters.status.split(',') : []
  );
  const [dateRange, setDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({
    from: currentFilters.dateFrom ? new Date(currentFilters.dateFrom) : undefined,
    to: currentFilters.dateTo ? new Date(currentFilters.dateTo) : undefined,
  });
  const [minAmount, setMinAmount] = useState(currentFilters.minAmount || '');
  const [maxAmount, setMaxAmount] = useState(currentFilters.maxAmount || '');
  const [currency, setCurrency] = useState(currentFilters.currency || '');
  const [search, setSearch] = useState(currentFilters.search || '');
  
  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (status.length > 0) count++;
    if (dateRange.from || dateRange.to) count++;
    if (minAmount || maxAmount) count++;
    if (currency) count++;
    return count;
  };

  // Apply filters
  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (status.length > 0) {
      params.set('status', status.join(','));
    }
    
    if (dateRange.from) {
      params.set('dateFrom', dateRange.from.toISOString().split('T')[0]);
    }
    
    if (dateRange.to) {
      params.set('dateTo', dateRange.to.toISOString().split('T')[0]);
    }
    
    if (minAmount) {
      params.set('minAmount', minAmount);
    }
    
    if (maxAmount) {
      params.set('maxAmount', maxAmount);
    }
    
    if (currency) {
      params.set('currency', currency);
    }
    
    if (search) {
      params.set('search', search);
    }
    
    // Reset to page 1 when filters change
    params.set('page', '1');
    
    // Keep per page setting if it exists
    if (currentFilters.perPage) {
      params.set('perPage', currentFilters.perPage);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };
  
  // Clear all filters
  const clearFilters = () => {
    setStatus([]);
    setDateRange({ from: undefined, to: undefined });
    setMinAmount('');
    setMaxAmount('');
    setCurrency('');
    setSearch('');
    
    // Keep only per page setting if it exists
    const params = new URLSearchParams();
    if (currentFilters.perPage) {
      params.set('perPage', currentFilters.perPage);
    }
    params.set('page', '1');
    
    router.push(`${pathname}?${params.toString()}`);
  };
  
  // Handle status toggle
  const toggleStatus = (value: string) => {
    setStatus(prev => 
      prev.includes(value)
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };
  
  // Handle search input with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== currentFilters.search) {
        const params = new URLSearchParams(window.location.search);
        
        if (search) {
          params.set('search', search);
        } else {
          params.delete('search');
        }
        
        // Reset to page 1 when search changes
        params.set('page', '1');
        
        router.push(`${pathname}?${params.toString()}`);
      }
    }, 500);
    
    return () => clearTimeout(handler);
  }, [search, currentFilters.search, pathname, router]);
  
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between mb-4">
        <div className="relative w-full md:w-auto flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search invoices..."
            className="pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Status</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={status.includes('PAID') ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleStatus('PAID')}
                    >
                      Paid
                    </Button>
                    <Button
                      variant={status.includes('PENDING') ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleStatus('PENDING')}
                    >
                      Pending
                    </Button>
                    <Button
                      variant={status.includes('OVERDUE') ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleStatus('OVERDUE')}
                    >
                      Overdue
                    </Button>
                    <Button
                      variant={status.includes('CANCELLED') ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleStatus('CANCELLED')}
                    >
                      Cancelled
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Date Range</h3>
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Amount Range</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="min-amount" className="text-xs">
                        Min
                      </Label>
                      <Input
                        id="min-amount"
                        type="number"
                        placeholder="0"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-amount" className="text-xs">
                        Max
                      </Label>
                      <Input
                        id="max-amount"
                        type="number"
                        placeholder="1000"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Currency</h3>
                  <Select
                    value={currency}
                    onValueChange={setCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All currencies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All currencies</SelectItem>
                      {currencies.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-between pt-2">
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    disabled={getActiveFilterCount() === 0}
                  >
                    Clear
                  </Button>
                  <Button onClick={applyFilters}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            align="end"
          >
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Date Range
            </Button>
          </DateRangePicker>
        </div>
      </div>
      
      {/* Active filter indicators */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {status.length > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              Status: {status.join(', ')}
              <button onClick={() => setStatus([])}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
          
          {(dateRange.from || dateRange.to) && (
            <Badge variant="outline" className="flex items-center gap-1">
              Date: {dateRange.from?.toLocaleDateString() || 'Any'} - {dateRange.to?.toLocaleDateString() || 'Any'}
              <button onClick={() => setDateRange({ from: undefined, to: undefined })}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
          
          {(minAmount || maxAmount) && (
            <Badge variant="outline" className="flex items-center gap-1">
              Amount: {minAmount || '0'} - {maxAmount || 'Any'}
              <button onClick={() => { setMinAmount(''); setMaxAmount(''); }}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
          
          {currency && (
            <Badge variant="outline" className="flex items-center gap-1">
              Currency: {currency}
              <button onClick={() => setCurrency('')}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="text-sm"
            onClick={clearFilters}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
} 