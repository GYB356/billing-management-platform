import { NotificationChannel, UsageAlertType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { sendWebhook } from '@/lib/webhook';

interface UsageMetrics {
  total: number;
  limit: number;
}

export async function checkUsageAlerts() {
  // Get all active usage alerts
  const alerts = await prisma.usageAlert.findMany({
    where: {
      enabled: true,
    },
    include: {
      subscription: {
        include: {
          customer: true,
        },
      },
      feature: true,
    },
  });

  for (const alert of alerts) {
    try {
      // Get current usage for the feature
      const usage = await prisma.usageRecord.aggregate({
        where: {
          subscriptionId: alert.subscriptionId,
          featureId: alert.featureId,
          timestamp: {
            gte: alert.subscription.currentPeriodStart,
            lte: alert.subscription.currentPeriodEnd,
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const currentUsage = usage._sum.quantity || 0;

      // Get feature limit from subscription plan
      const planFeature = await prisma.planFeatureAssociation.findFirst({
        where: {
          planId: alert.subscription.planId,
          featureId: alert.featureId,
        },
      });

      const limit = planFeature?.limits ? 
        JSON.parse(planFeature.limits as string).maxValue || Infinity : 
        Infinity;

      // Check if threshold is exceeded
      const metrics: UsageMetrics = {
        total: currentUsage,
        limit,
      };

      const isThresholdExceeded = checkThreshold(alert.type, alert.threshold, metrics);

      if (isThresholdExceeded) {
        // Only send notification if we haven't sent one recently (within last 24 hours)
        const shouldNotify = !alert.lastTriggered || 
          (new Date().getTime() - alert.lastTriggered.getTime()) > 24 * 60 * 60 * 1000;

        if (shouldNotify) {
          await sendAlertNotifications(alert, metrics);

          // Update last triggered timestamp
          await prisma.usageAlert.update({
            where: { id: alert.id },
            data: { lastTriggered: new Date() },
          });
        }
      }
    } catch (error) {
      console.error(`Error processing alert ${alert.id}:`, error);
    }
  }
}

function checkThreshold(
  type: UsageAlertType,
  threshold: number,
  metrics: UsageMetrics
): boolean {
  if (type === 'PERCENTAGE') {
    if (metrics.limit === Infinity) return false;
    const percentage = (metrics.total / metrics.limit) * 100;
    return percentage >= threshold;
  } else {
    // ABSOLUTE type
    return metrics.total >= threshold;
  }
}

async function sendAlertNotifications(
  alert: any,
  metrics: UsageMetrics
) {
  const { subscription, feature, notifyVia } = alert;
  const { customer } = subscription;

  const message = {
    subject: `Usage Alert: ${feature.name}`,
    content: `
      Your usage of ${feature.name} has reached ${metrics.total} ${feature.unitLabel || 'units'}.
      ${metrics.limit !== Infinity ? `Your current limit is ${metrics.limit} ${feature.unitLabel || 'units'}.` : ''}
      Please review your usage in the dashboard.
    `,
  };

  for (const channel of notifyVia) {
    try {
      if (channel === 'EMAIL' && customer.email) {
        await sendEmail({
          to: customer.email,
          subject: message.subject,
          text: message.content,
        });
      } else if (channel === 'WEBHOOK') {
        // Get webhook endpoints for the customer's organization
        const webhookEndpoints = await prisma.webhookEndpoint.findMany({
          where: {
            organizationId: customer.organizationId,
            isActive: true,
            events: {
              has: 'usage.alert',
            },
          },
        });

        for (const endpoint of webhookEndpoints) {
          await sendWebhook(endpoint.url, {
            type: 'usage.alert',
            data: {
              customerId: customer.id,
              subscriptionId: subscription.id,
              feature: {
                id: feature.id,
                name: feature.name,
              },
              usage: metrics.total,
              limit: metrics.limit,
              threshold: alert.threshold,
              thresholdType: alert.type,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error(`Error sending ${channel} notification for alert ${alert.id}:`, error);
    }
  }
}
