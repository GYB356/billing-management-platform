'use client';

import * as React from 'react';
import { addDays, format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateRangePickerProps {
  value: {
    from?: Date;
    to?: Date;
  };
  onChange: (value: { from?: Date; to?: Date }) => void;
  align?: 'start' | 'center' | 'end';
  children?: React.ReactNode;
}

export function DateRangePicker({
  value,
  onChange,
  align = 'start',
  children,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Predefined ranges
  const predefinedRanges = React.useMemo(() => [
    {
      label: 'Today',
      getValue: () => {
        const today = new Date();
        return { from: today, to: today };
      },
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = addDays(new Date(), -1);
        return { from: yesterday, to: yesterday };
      },
    },
    {
      label: 'Last 7 days',
      getValue: () => ({
        from: addDays(new Date(), -6),
        to: new Date(),
      }),
    },
    {
      label: 'Last 30 days',
      getValue: () => ({
        from: addDays(new Date(), -29),
        to: new Date(),
      }),
    },
    {
      label: 'This month',
      getValue: () => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: firstDayOfMonth, to: today };
      },
    },
    {
      label: 'Last month',
      getValue: () => {
        const today = new Date();
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: firstDayOfLastMonth, to: lastDayOfLastMonth };
      },
    },
    {
      label: 'This year',
      getValue: () => {
        const today = new Date();
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        return { from: firstDayOfYear, to: today };
      },
    },
    {
      label: 'All time',
      getValue: () => ({ from: undefined, to: undefined }),
    },
  ], []);

  // Format date range for display
  const formatDateRange = () => {
    if (!value.from && !value.to) return 'Select date range';
    if (value.from && !value.to) return `From ${format(value.from, 'MMM dd, yyyy')}`;
    if (!value.from && value.to) return `Until ${format(value.to, 'MMM dd, yyyy')}`;
    
    return `${format(value.from, 'MMM dd, yyyy')} - ${format(value.to, 'MMM dd, yyyy')}`;
  };

  // Apply a predefined range
  const applyPredefinedRange = (rangeIndex: string) => {
    const index = parseInt(rangeIndex);
    if (index >= 0 && index < predefinedRanges.length) {
      const newValue = predefinedRanges[index].getValue();
      onChange(newValue);
    }
  };

  // Determine if a predefined range is selected
  const getSelectedPredefinedRange = () => {
    // This is a simple implementation. A more robust one would compare actual date values.
    // For now, this returns -1 (custom range) in most cases
    return '-1';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children ? children : (
          <Button variant="outline" className="justify-start text-left">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0" sideOffset={4}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Preset Ranges</label>
              <Select
                value={getSelectedPredefinedRange()}
                onValueChange={applyPredefinedRange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Custom Range</SelectItem>
                  {predefinedRanges.map((range, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Select</label>
              <div className="grid grid-cols-2 gap-2">
                {predefinedRanges.slice(0, 6).map((range, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      onChange(range.getValue());
                    }}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <Calendar
              mode="range"
              selected={{
                from: value.from || undefined,
                to: value.to || undefined,
              }}
              onSelect={(range) => {
                onChange({
                  from: range?.from,
                  to: range?.to,
                });
              }}
              numberOfMonths={1}
              defaultMonth={value.from}
            />
          </div>
        </div>
        
        <div className="border-t border-gray-200 p-4 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              onChange({ from: undefined, to: undefined });
              setIsOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
} 