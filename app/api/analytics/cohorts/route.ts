import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  addDays, 
  addMonths, 
  addWeeks, 
  format,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  subMonths,
  subWeeks,
  subQuarters
} from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check admin permissions
    if (session.user.role !== 'ADMIN') {
      return new NextResponse('Insufficient permissions', { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'monthly';
    const metric = searchParams.get('metric') || 'retention';
    const monthsLookback = parseInt(searchParams.get('lookback') || '12', 10);
    
    // Determine date ranges based on timeframe
    const now = new Date();
    let periods: string[] = [];
    let cohorts: { startDate: Date; endDate: Date; label: string; }[] = [];
    
    // Generate cohort date ranges and labels
    switch (timeframe) {
      case 'weekly':
        // Generate the last 12 weeks (including current)
        for (let i = 0; i < 12; i++) {
          const startDate = startOfWeek(subWeeks(now, i));
          const endDate = endOfWeek(startDate);
          cohorts.unshift({
            startDate,
            endDate,
            label: `Week of ${format(startDate, 'MMM d, yyyy')}`
          });
        }
        
        // Generate 8 period labels (Week 1, Week 2, etc.)
        periods = Array.from({ length: 8 }, (_, i) => `Week ${i + 1}`);
        break;
        
      case 'quarterly':
        // Generate the last 8 quarters
        for (let i = 0; i < 8; i++) {
          const startDate = startOfQuarter(subQuarters(now, i));
          const endDate = endOfQuarter(startDate);
          cohorts.unshift({
            startDate,
            endDate,
            label: `Q${Math.floor(startDate.getMonth() / 3) + 1} ${startDate.getFullYear()}`
          });
        }
        
        // Generate 6 period labels (Quarter 1, Quarter 2, etc.)
        periods = Array.from({ length: 6 }, (_, i) => `Quarter ${i + 1}`);
        break;
        
      case 'monthly':
      default:
        // Generate the last N months
        for (let i = 0; i < monthsLookback; i++) {
          const startDate = startOfMonth(subMonths(now, i));
          const endDate = endOfMonth(startDate);
          cohorts.unshift({
            startDate,
            endDate,
            label: format(startDate, 'MMM yyyy')
          });
        }
        
        // Generate period labels (Month 1, Month 2, etc.) - we show 12 periods max
        periods = Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`);
        break;
    }
    
    // Generate cohort analysis data
    const cohortData = await Promise.all(
      cohorts.map(async (cohort) => {
        // Get all subscriptions created during this cohort's period
        const subscriptions = await prisma.subscription.findMany({
          where: {
            createdAt: {
              gte: cohort.startDate,
              lte: cohort.endDate,
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            canceledAt: true,
            pauseHistories: {
              select: {
                startDate: true,
                endDate: true,
              },
            },
            price: true,
            invoices: {
              select: {
                amount: true,
                createdAt: true,
                status: true,
              },
            },
          },
        });
        
        // Initial count of subscriptions in this cohort
        const initialCount = subscriptions.length;
        
        // Skip empty cohorts
        if (initialCount === 0) {
          return {
            date: cohort.label,
            initialCount: 0,
            retentionByPeriod: Array(periods.length).fill(0),
          };
        }
        
        // Calculate metrics for each period
        const retentionByPeriod = periods.map((_, periodIndex) => {
          // Determine the end date for this period
          let periodEndDate: Date;
          
          switch (timeframe) {
            case 'weekly':
              periodEndDate = addWeeks(cohort.endDate, periodIndex + 1);
              break;
            case 'quarterly':
              periodEndDate = addMonths(cohort.endDate, (periodIndex + 1) * 3);
              break;
            case 'monthly':
            default:
              periodEndDate = addMonths(cohort.endDate, periodIndex + 1);
              break;
          }
          
          // Don't calculate future periods
          if (periodEndDate > now) {
            return null;
          }
          
          // Calculate metric based on selection
          switch (metric) {
            case 'churn':
              // Calculate churn rate
              const churnedInPeriod = subscriptions.filter(sub => 
                sub.canceledAt && 
                sub.canceledAt > cohort.endDate && 
                sub.canceledAt <= periodEndDate
              ).length;
              
              // Active at beginning of period
              const activeAtPeriodStart = subscriptions.filter(sub => 
                !sub.canceledAt || sub.canceledAt > cohort.endDate
              ).length;
              
              return activeAtPeriodStart > 0 
                ? (churnedInPeriod / activeAtPeriodStart) * 100 
                : 0;
              
            case 'revenue':
              // Calculate revenue per customer
              const revenueInPeriod = subscriptions.reduce((total, sub) => {
                const subInvoices = sub.invoices.filter(inv => 
                  inv.createdAt > cohort.endDate && 
                  inv.createdAt <= periodEndDate &&
                  inv.status === 'PAID'
                );
                
                const invoiceTotal = subInvoices.reduce((sum, inv) => sum + inv.amount, 0);
                return total + invoiceTotal;
              }, 0);
              
              // Return average revenue per customer
              return initialCount > 0 ? revenueInPeriod / initialCount : 0;
              
            case 'retention':
            default:
              // Calculate retention rate
              const activeInPeriod = subscriptions.filter(sub => {
                // Check if subscription was active at the end of this period
                if (sub.canceledAt && sub.canceledAt <= periodEndDate) {
                  return false;
                }
                
                // Check if subscription was paused during this period
                const wasPaused = sub.pauseHistories.some(pause => 
                  !pause.endDate && periodEndDate >= pause.startDate
                );
                
                return !wasPaused;
              }).length;
              
              // Return as percentage
              return (activeInPeriod / initialCount) * 100;
          }
        });
        
        // Filter out null values (future periods)
        const filteredRetention = retentionByPeriod.filter(value => value !== null) as number[];
        
        return {
          date: cohort.label,
          initialCount,
          retentionByPeriod: filteredRetention,
        };
      })
    );
    
    // Filter out empty cohorts
    const filteredCohorts = cohortData.filter(cohort => cohort.initialCount > 0);
    
    // Adjust period labels to match the actual periods we have data for
    const maxPeriods = Math.max(...filteredCohorts.map(c => c.retentionByPeriod.length));
    const adjustedPeriods = periods.slice(0, maxPeriods);
    
    // Return the compiled data
    return NextResponse.json({
      cohorts: filteredCohorts,
      periods: adjustedPeriods,
      metric,
      timeframe,
    });
    
  } catch (error) {
    console.error('Error generating cohort analysis:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 