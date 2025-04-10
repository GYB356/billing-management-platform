'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/currency';
import { format } from 'date-fns';

interface SubscriptionDetailsProps {
  subscription: {
    id: string;
    status: string;
    plan: {
      name: string;
      price: number;
      currency: string;
      interval: string;
      features: string[];
    };
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
}

export function SubscriptionDetails({ subscription }: SubscriptionDetailsProps) {
  // ... rest of the code from the prompt ...
}
