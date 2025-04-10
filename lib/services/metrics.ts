import { prisma } from '@/lib/prisma';
import { Redis } from 'ioredis';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export class MetricsCollector {
  // ...rest of the code from the prompt...
}

export const metricsCollector = MetricsCollector.getInstance();
