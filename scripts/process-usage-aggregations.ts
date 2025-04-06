import { prisma } from '@/lib/prisma';
import { UsageAggregator } from '@/lib/services/usage-aggregator';
import { createEvent } from '@/lib/events';

async function startUsageAggregations() {
  try {
    console.log('Starting usage aggregation worker...');

    // Get all metrics that need aggregation
    const metrics = await prisma.usageMetric.findMany({
      where: {
        active: true,
        meteringConfig: {
          isNot: null
        }
      },
      include: {
        meteringConfig: true
      }
    });

    console.log(`Found ${metrics.length} metrics to process`);
    const aggregator = UsageAggregator.getInstance();

    // Start aggregation for each metric
    for (const metric of metrics) {
      const config = {
        type: metric.meteringConfig!.type,
        method: metric.meteringConfig!.aggregationType,
        interval: metric.meteringConfig!.resetInterval || 'hourly',
        dimensions: metric.meteringConfig!.dimensions || []
      };

      try {
        await aggregator.startAggregation(metric.id, config);
        console.log(`Started aggregation for metric: ${metric.name}`);

        await createEvent({
          type: 'AGGREGATION_STARTED',
          resourceType: 'USAGE_METRIC',
          resourceId: metric.id,
          metadata: {
            config
          }
        });
      } catch (error) {
        console.error(`Failed to start aggregation for metric ${metric.name}:`, error);
        
        await createEvent({
          type: 'AGGREGATION_START_FAILED',
          resourceType: 'USAGE_METRIC',
          resourceId: metric.id,
          severity: 'ERROR',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            config
          }
        });
      }
    }

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('Shutting down usage aggregation worker...');
      await aggregator.dispose();
      process.exit(0);
    });

    console.log('Usage aggregation worker running...');
  } catch (error) {
    console.error('Error in usage aggregation worker:', error);
    process.exit(1);
  }
}

startUsageAggregations();