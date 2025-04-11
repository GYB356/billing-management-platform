import prisma from '@/lib/prisma';
import { createEvent, EventType } from '@/lib/events';

interface TaxReportParams {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

interface TaxAnalytics {
  totalRevenue: number;
  totalTax: number;
  averageTaxRate: number;
  taxByType: Record<string, number>;
  taxByRegion: Record<string, number>;
  exemptTransactions: number;
  taxableTransactions: number;
}

interface TaxReport {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalTaxAmount: number;
    totalRevenue: number;
    averageTaxRate: number;
    taxableTransactions: number;
    exemptTransactions: number;
  };
  breakdown: {
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    periodic: Record<string, {
      revenue: number;
      tax: number;
      transactionCount: number;
    }>;
  };
  exemptions: any[]; // Type will be updated to match Prisma schema
}

export class TaxReportingService {
  /**
   * Generate a comprehensive tax report
   */
  public async generateTaxReport(params: TaxReportParams): Promise<TaxReport> {
    const { organizationId, startDate, endDate, groupBy = 'month' } = params;

    // Get all invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: {
          in: ['PAID', 'PARTIALLY_PAID']
        }
      },
      include: {
        taxRates: true,
        customer: true
      }
    });

    // Calculate tax totals
    const taxTotals = await this.calculateTaxTotals(invoices);

    // Generate periodic breakdown
    const periodicData = await this.generatePeriodicBreakdown(invoices, groupBy);

    // Get tax exemption data
    const exemptionData = await this.getExemptionData(organizationId, startDate, endDate);

    const report: TaxReport = {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      summary: {
        totalTaxAmount: taxTotals.totalTax,
        totalRevenue: taxTotals.totalRevenue,
        averageTaxRate: taxTotals.averageTaxRate,
        taxableTransactions: taxTotals.taxableTransactions,
        exemptTransactions: taxTotals.exemptTransactions
      },
      breakdown: {
        byType: taxTotals.taxByType,
        byRegion: taxTotals.taxByRegion,
        periodic: periodicData
      },
      exemptions: exemptionData
    };

    // Log report generation
    await createEvent({
      eventType: EventType.TAX_REPORT_GENERATED,
      resourceType: 'TAX_REPORT',
      resourceId: organizationId,
      metadata: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        summary: report.summary
      }
    });

    return report;
  }

  /**
   * Calculate tax analytics
   */
  public async generateTaxAnalytics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TaxAnalytics> {
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        taxRates: true
      }
    });

    let totalRevenue = 0;
    let totalTax = 0;
    const taxByType: Record<string, number> = {};
    const taxByRegion: Record<string, number> = {};
    let taxableTransactions = 0;
    let exemptTransactions = 0;

    for (const invoice of invoices) {
      totalRevenue += invoice.subtotal;
      
      if (invoice.taxRates.length > 0) {
        taxableTransactions++;
        const invoiceTax = invoice.taxAmount || 0;
        totalTax += invoiceTax;

        // Aggregate by tax type and region
        for (const taxRate of invoice.taxRates) {
          taxByType[taxRate.type] = (taxByType[taxRate.type] || 0) + invoiceTax;
          const region = taxRate.state ? `${taxRate.country}-${taxRate.state}` : taxRate.country;
          taxByRegion[region] = (taxByRegion[region] || 0) + invoiceTax;
        }
      } else {
        exemptTransactions++;
      }
    }

    const averageTaxRate = totalRevenue > 0 ? (totalTax / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalTax,
      averageTaxRate,
      taxByType,
      taxByRegion,
      taxableTransactions,
      exemptTransactions
    };
  }

  private async calculateTaxTotals(invoices: any[]): Promise<{
    totalRevenue: number;
    totalTax: number;
    averageTaxRate: number;
    taxByType: Record<string, number>;
    taxByRegion: Record<string, number>;
    taxableTransactions: number;
    exemptTransactions: number;
  }> {
    let totalRevenue = 0;
    let totalTax = 0;
    const taxByType: Record<string, number> = {};
    const taxByRegion: Record<string, number> = {};
    let taxableTransactions = 0;
    let exemptTransactions = 0;

    for (const invoice of invoices) {
      totalRevenue += invoice.subtotal;
      
      if (invoice.taxRates.length > 0) {
        taxableTransactions++;
        const invoiceTax = invoice.taxAmount || 0;
        totalTax += invoiceTax;

        for (const taxRate of invoice.taxRates) {
          taxByType[taxRate.type] = (taxByType[taxRate.type] || 0) + invoiceTax;
          const region = taxRate.state ? `${taxRate.country}-${taxRate.state}` : taxRate.country;
          taxByRegion[region] = (taxByRegion[region] || 0) + invoiceTax;
        }
      } else {
        exemptTransactions++;
      }
    }

    return {
      totalRevenue,
      totalTax,
      averageTaxRate: totalRevenue > 0 ? (totalTax / totalRevenue) * 100 : 0,
      taxByType,
      taxByRegion,
      taxableTransactions,
      exemptTransactions
    };
  }

  private async generatePeriodicBreakdown(invoices: any[], groupBy: string) {
    const breakdown: Record<string, {
      revenue: number;
      tax: number;
      transactionCount: number;
    }> = {};

    for (const invoice of invoices) {
      const period = this.getPeriodKey(invoice.createdAt, groupBy);
      
      if (!breakdown[period]) {
        breakdown[period] = {
          revenue: 0,
          tax: 0,
          transactionCount: 0
        };
      }

      breakdown[period].revenue += invoice.subtotal;
      breakdown[period].tax += invoice.taxAmount || 0;
      breakdown[period].transactionCount++;
    }

    return breakdown;
  }

  private async getExemptionData(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ) {
    return prisma.taxExemption.findMany({
      where: {
        organizationId,
        OR: [
          {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            validUntil: {
              gte: startDate,
              lte: endDate
            }
          }
        ]
      }
    });
  }

  private getPeriodKey(date: Date, groupBy: string): string {
    const d = new Date(date);
    switch (groupBy) {
      case 'day':
        return d.toISOString().split('T')[0];
      case 'week':
        const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
        return `${d.getFullYear()}-W${week}`;
      case 'month':
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      case 'quarter':
        const quarter = Math.ceil((d.getMonth() + 1) / 3);
        return `${d.getFullYear()}-Q${quarter}`;
      case 'year':
        return d.getFullYear().toString();
      default:
        return d.toISOString().split('T')[0];
    }
  }
}