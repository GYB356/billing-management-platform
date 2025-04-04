import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const metrics = req.body;

    // Store metrics in database
    await prisma.i18nMetrics.create({
      data: {
        averageLoadTime: metrics.averageLoadTime,
        cacheHitRate: metrics.cacheHitRate,
        totalBundleSize: metrics.totalBundleSize,
        translations: {
          create: metrics.translations.map((t: any) => ({
            language: t.language,
            loadTime: t.loadTime,
            cacheHit: t.cacheHit,
            bundleSize: t.bundleSize,
            timestamp: new Date(t.timestamp)
          }))
        }
      }
    });

    // Check for performance issues
    const performanceIssues = [];
    
    if (metrics.averageLoadTime > 1000) {
      performanceIssues.push({
        type: 'high_load_time',
        message: 'Translation load time exceeds 1 second',
        value: metrics.averageLoadTime
      });
    }

    if (metrics.cacheHitRate < 80) {
      performanceIssues.push({
        type: 'low_cache_hit_rate',
        message: 'Translation cache hit rate below 80%',
        value: metrics.cacheHitRate
      });
    }

    if (metrics.totalBundleSize > 500 * 1024) {
      performanceIssues.push({
        type: 'large_bundle_size',
        message: 'Translation bundle size exceeds 500KB',
        value: metrics.totalBundleSize
      });
    }

    // If there are performance issues, create alerts
    if (performanceIssues.length > 0) {
      await prisma.i18nAlert.create({
        data: {
          issues: performanceIssues,
          timestamp: new Date()
        }
      });
    }

    return res.status(200).json({ message: 'Metrics stored successfully' });
  } catch (error) {
    console.error('Failed to store i18n metrics:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}