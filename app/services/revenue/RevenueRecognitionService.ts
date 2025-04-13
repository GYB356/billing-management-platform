import { prisma } from '@/lib/prisma';
import { Subscription, RevenueLedger, RevenueRecognitionRule } from '@prisma/client';

export class RevenueRecognitionService {
  // Process new subscription revenue
  async processSubscriptionRevenue(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            revenueRules: true
          }
        }
      }
    });

    if (!subscription) throw new Error('Subscription not found');

    const rule = subscription.plan.revenueRules[0]; // Assuming one rule per plan
    if (!rule) throw new Error('No revenue recognition rule found');

    switch (rule.type) {
      case 'IMMEDIATE':
        await this.recognizeImmediate(subscription, rule);
        break;
      case 'STRAIGHT_LINE':
        await this.recognizeStraightLine(subscription, rule);
        break;
      case 'USAGE_BASED':
        await this.recognizeUsageBased(subscription, rule);
        break;
      case 'MILESTONE':
        await this.recognizeMilestone(subscription, rule);
        break;
      default:
        throw new Error(`Unsupported revenue recognition type: ${rule.type}`);
    }
  }

  // Immediate recognition (one-time charges)
  private async recognizeImmediate(
    subscription: Subscription & { plan: any },
    rule: RevenueRecognitionRule
  ) {
    await prisma.revenueLedger.create({
      data: {
        subscriptionId: subscription.id,
        amount: subscription.plan.currentPrice,
        currency: subscription.plan.currency,
        recognizedDate: new Date(),
        type: 'RECURRING',
        status: 'RECOGNIZED',
        metadata: {
          rule: rule.id,
          recognitionType: 'IMMEDIATE'
        }
      }
    });
  }

  // Straight-line recognition (subscription revenue)
  private async recognizeStraightLine(
    subscription: Subscription & { plan: any },
    rule: RevenueRecognitionRule
  ) {
    const totalAmount = subscription.plan.currentPrice;
    const periodMonths = subscription.plan.interval === 'year' ? 12 : 1;
    const monthlyAmount = totalAmount / periodMonths;

    // Create deferred revenue entry
    await prisma.revenueLedger.create({
      data: {
        subscriptionId: subscription.id,
        amount: totalAmount,
        currency: subscription.plan.currency,
        recognizedDate: new Date(),
        deferredAmount: totalAmount,
        deferredUntil: this.addMonths(new Date(), periodMonths),
        type: 'RECURRING',
        status: 'DEFERRED',
        metadata: {
          rule: rule.id,
          recognitionType: 'STRAIGHT_LINE',
          recognitionSchedule: Array.from({ length: periodMonths }, (_, i) => ({
            month: i + 1,
            amount: monthlyAmount
          }))
        }
      }
    });
  }

  // Usage-based recognition
  private async recognizeUsageBased(
    subscription: Subscription & { plan: any },
    rule: RevenueRecognitionRule
  ) {
    // Get usage records for the period
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        subscriptionId: subscription.id,
        processed: false
      }
    });

    const totalUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);
    const amount = totalUsage * subscription.plan.currentPrice;

    // Create revenue entry for usage
    await prisma.revenueLedger.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: subscription.plan.currency,
        recognizedDate: new Date(),
        type: 'USAGE',
        status: 'RECOGNIZED',
        metadata: {
          rule: rule.id,
          recognitionType: 'USAGE_BASED',
          usageRecords: usageRecords.map(r => r.id)
        }
      }
    });

    // Mark usage records as processed
    await prisma.usageRecord.updateMany({
      where: {
        id: {
          in: usageRecords.map(r => r.id)
        }
      },
      data: {
        processed: true
      }
    });
  }

  // Milestone-based recognition
  private async recognizeMilestone(
    subscription: Subscription & { plan: any },
    rule: RevenueRecognitionRule
  ) {
    const conditions = rule.conditions as {
      milestones: Array<{
        name: string;
        percentage: number;
        criteria: any;
      }>;
    };

    // Check each milestone
    for (const milestone of conditions.milestones) {
      const isMet = await this.checkMilestoneCriteria(
        subscription.id,
        milestone.criteria
      );

      if (isMet) {
        const amount = subscription.plan.currentPrice * (milestone.percentage / 100);

        await prisma.revenueLedger.create({
          data: {
            subscriptionId: subscription.id,
            amount,
            currency: subscription.plan.currency,
            recognizedDate: new Date(),
            type: 'MILESTONE',
            status: 'RECOGNIZED',
            metadata: {
              rule: rule.id,
              recognitionType: 'MILESTONE',
              milestone: milestone.name,
              percentage: milestone.percentage
            }
          }
        });
      }
    }
  }

  // Process deferred revenue recognition
  async processDeferredRevenue() {
    const deferredEntries = await prisma.revenueLedger.findMany({
      where: {
        status: 'DEFERRED',
        deferredUntil: {
          gte: new Date()
        }
      }
    });

    for (const entry of deferredEntries) {
      const schedule = entry.metadata.recognitionSchedule as Array<{
        month: number;
        amount: number;
      }>;

      const currentMonth = this.getMonthDifference(
        new Date(entry.createdAt),
        new Date()
      );

      const monthlyRecognition = schedule.find(s => s.month === currentMonth);
      if (monthlyRecognition) {
        // Create recognition entry
        await prisma.revenueLedger.create({
          data: {
            subscriptionId: entry.subscriptionId,
            amount: monthlyRecognition.amount,
            currency: entry.currency,
            recognizedDate: new Date(),
            type: entry.type,
            status: 'RECOGNIZED',
            metadata: {
              originalEntry: entry.id,
              recognitionMonth: currentMonth,
              totalMonths: schedule.length
            }
          }
        });

        // Update deferred amount
        await prisma.revenueLedger.update({
          where: { id: entry.id },
          data: {
            deferredAmount: entry.deferredAmount! - monthlyRecognition.amount
          }
        });
      }
    }
  }

  // Helper functions
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private getMonthDifference(startDate: Date, endDate: Date): number {
    return (
      endDate.getMonth() -
      startDate.getMonth() +
      12 * (endDate.getFullYear() - startDate.getFullYear())
    );
  }

  private async checkMilestoneCriteria(
    subscriptionId: string,
    criteria: any
  ): Promise<boolean> {
    // Implement milestone criteria checking logic
    // This would vary based on your specific milestone requirements
    return true; // Placeholder
  }
} 