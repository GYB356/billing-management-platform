import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addMonths, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

async function calculateMRR() {
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { 
      status: 'ACTIVE',
      endDate: null
    },
    include: {
      plan: true
    }
  });

  return activeSubscriptions.reduce((total, sub) => {
    const monthlyAmount = sub.plan.billingInterval === 'YEAR' 
      ? sub.plan.price / 12 
      : sub.plan.price;
    return total + (monthlyAmount * (sub.quantity || 1));
  }, 0);
}

async function calculateLTV() {
  const [totalRevenue, totalCustomers] = await Promise.all([
    prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: {
        price: true
      }
    }),
    prisma.subscription.groupBy({
      by: ['organizationId'],
      where: { status: 'ACTIVE' },
      _count: true
    })
  ]);

  const revenue = totalRevenue._sum.price || 0;
  const customers = totalCustomers.length;

  return customers > 0 ? revenue / customers : 0;
}

async function getHistoricalMRR() {
  const months = 12;
  const now = new Date();
  const data = [];
  const labels = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const startDate = startOfMonth(date);
    const endDate = endOfMonth(date);

    const monthlyRevenue = await prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
        createdAt: { lte: endDate },
        OR: [
          { endDate: null },
          { endDate: { gt: startDate } }
        ]
      },
      _sum: {
        price: true
      }
    });

    labels.push(format(date, 'MMM yyyy'));
    data.push(monthlyRevenue._sum.price || 0);
  }

  return { labels, data };
}

async function getCohortRetention() {
  const cohorts = 6;
  const now = new Date();
  const labels = [];
  const data = [];

  for (let i = 0; i < cohorts; i++) {
    const cohortStart = startOfMonth(subMonths(now, i + 1));
    const cohortEnd = endOfMonth(cohortStart);

    // Get total subscriptions in cohort
    const totalInCohort = await prisma.subscription.count({
      where: {
        createdAt: {
          gte: cohortStart,
          lte: cohortEnd
        }
      }
    });

    // Get active subscriptions from cohort
    const activeFromCohort = await prisma.subscription.count({
      where: {
        createdAt: {
          gte: cohortStart,
          lte: cohortEnd
        },
        status: 'ACTIVE'
      }
    });

    const retentionRate = totalInCohort > 0 
      ? (activeFromCohort / totalInCohort) * 100 
      : 0;

    labels.push(format(cohortStart, 'MMM yyyy'));
    data.push(retentionRate);
  }

  return { labels, data: data.reverse() };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [
      mrr,
      historicalMrr,
      cohortRetention,
      ltv,
      revenueByPlan,
      churnRate
    ] = await Promise.all([
      calculateMRR(),
      getHistoricalMRR(),
      getCohortRetention(),
      calculateLTV(),
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _sum: {
          price: true
        }
      }),
      prisma.subscription.aggregate({
        where: {
          status: 'CANCELED',
          updatedAt: {
            gte: subMonths(new Date(), 1)
          }
        },
        _count: true
      }).then(canceledCount => 
        prisma.subscription.count({
          where: { status: 'ACTIVE' }
        }).then(activeCount => 
          activeCount > 0 ? (canceledCount._count / activeCount) * 100 : 0
        )
      )
    ]);

    return NextResponse.json({
      mrr,
      arr: mrr * 12,
      ltv,
      churnRate,
      revenueByPlan: Object.fromEntries(
        revenueByPlan.map(({ planId, _sum }) => [planId, _sum.price || 0])
      ),
      historicalMrr,
      cohortRetention
    });
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial metrics' },
      { status: 500 }
    );
  }
}