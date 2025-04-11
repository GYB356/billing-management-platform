import prisma from '@/lib/prisma';
import { TaxService } from './tax-service';
import { TaxReportingService } from './tax-reporting-service';

interface TaxReportCacheOptions {
  organizationId: string;
  reportType: 'monthly' | 'quarterly' | 'annual';
  period: string; // Format: YYYY-MM for monthly, YYYY-QQ for quarterly, YYYY for annual
  forceRefresh?: boolean;
}

export class TaxReportCacheService {
  private readonly taxService: TaxService;
  private readonly reportingService: TaxReportingService;
  
  constructor() {
    this.taxService = new TaxService();
    this.reportingService = new TaxReportingService();
  }
  
  /**
   * Get a tax report, using cache if available
   */
  public async getTaxReport({
    organizationId,
    reportType,
    period,
    forceRefresh = false
  }: TaxReportCacheOptions) {
    // Check if we have a valid cached report
    if (!forceRefresh) {
      const cachedReport = await prisma.taxReportCache.findFirst({
        where: {
          organizationId,
          reportType,
          period,
          expiresAt: {
            gt: new Date()
          }
        }
      });
      
      if (cachedReport) {
        return JSON.parse(cachedReport.reportData);
      }
    }
    
    // Generate a new report
    let report;
    switch (reportType) {
      case 'monthly':
        const [year, month] = period.split('-');
        report = await this.reportingService.generateMonthlyReport(
          organizationId,
          parseInt(year),
          parseInt(month)
        );
        break;
      case 'quarterly':
        const [qYear, quarter] = period.split('-');
        report = await this.reportingService.generateQuarterlyReport(
          organizationId,
          parseInt(qYear),
          parseInt(quarter)
        );
        break;
      case 'annual':
        report = await this.reportingService.generateAnnualReport(
          organizationId,
          parseInt(period)
        );
        break;
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
    
    // Cache the report
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // Cache for 30 days
    
    await prisma.taxReportCache.upsert({
      where: {
        organizationId_reportType_period: {
          organizationId,
          reportType,
          period
        }
      },
      update: {
        reportData: JSON.stringify(report),
        updatedAt: new Date(),
        expiresAt: expirationDate
      },
      create: {
        organizationId,
        reportType,
        period,
        reportData: JSON.stringify(report),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: expirationDate
      }
    });
    
    return report;
  }
  
  /**
   * Invalidate cache for a specific organization
   */
  public async invalidateCache(organizationId: string) {
    await prisma.taxReportCache.updateMany({
      where: {
        organizationId
      },
      data: {
        expiresAt: new Date() // Expire immediately
      }
    });
  }
  
  /**
   * Clear expired cache entries
   */
  public async cleanupExpiredCache() {
    const result = await prisma.taxReportCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    return result.count;
  }
}
