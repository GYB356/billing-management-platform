import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function TaxRatesLoading() {
  return (
    <div className="rounded-md border">
      <div className="border-b">
        <div className="grid grid-cols-6 gap-4 p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
} 