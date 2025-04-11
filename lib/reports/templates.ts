import { format } from 'date-fns';

export interface ReportTemplate {
  name: string;
  description: string;
  generate: (data: any) => Promise<any>;
  formatters: {
    [key: string]: (data: any) => any;
  };
}

export const reportTemplates: { [key: string]: ReportTemplate } = {
  customerLifetimeValue: {
    name: 'Customer Lifetime Value',
    description: 'Analyze customer value over their entire relationship',
    generate: async (data) => {
      const { customers, invoices, subscriptions } = data;
      return customers.map((customer: any) => ({
        customerId: customer.id,
        customerName: customer.name,
        totalRevenue: invoices
          .filter((i: any) => i.customerId === customer.id)
          .reduce((sum: number, i: any) => sum + i.amount, 0),
        subscriptionMonths: subscriptions
          .filter((s: any) => s.customerId === customer.id)
          .reduce((sum: number, s: any) => sum + s.durationMonths, 0),
        averageMonthlyRevenue: totalRevenue / subscriptionMonths,
      }));
    },
    formatters: {
      csv: (data) => convertToCSV(data),
      pdf: (data) => generatePDFReport(data),
      excel: (data) => generateExcelReport(data),
    },
  },

  revenueBreakdown: {
    name: 'Revenue Breakdown',
    description: 'Detailed analysis of revenue sources and patterns',
    generate: async (data) => {
      const { invoices, plans } = data;
      return {
        byPlan: plans.map((plan: any) => ({
          planName: plan.name,
          revenue: invoices
            .filter((i: any) => i.planId === plan.id)
            .reduce((sum: number, i: any) => sum + i.amount, 0),
          customerCount: new Set(
            invoices
              .filter((i: any) => i.planId === plan.id)
              .map((i: any) => i.customerId)
          ).size,
        })),
        byMonth: groupByMonth(invoices),
        byRegion: groupByRegion(invoices),
      };
    },
    formatters: {
      csv: (data) => convertToCSV(data),
      pdf: (data) => generatePDFReport(data),
      excel: (data) => generateExcelReport(data),
    },
  },

  churnAnalysis: {
    name: 'Churn Analysis',
    description: 'Detailed analysis of customer churn patterns',
    generate: async (data) => {
      const { subscriptions, customers } = data;
      return {
        overall: calculateOverallChurnRate(subscriptions),
        byPlan: calculateChurnByPlan(subscriptions),
        byCustomerSize: calculateChurnByCustomerSize(subscriptions, customers),
        predictiveMetrics: await generateChurnPredictions(subscriptions),
      };
    },
    formatters: {
      csv: (data) => convertToCSV(data),
      pdf: (data) => generatePDFReport(data),
      excel: (data) => generateExcelReport(data),
    },
  },

  usagePatterns: {
    name: 'Usage Patterns',
    description: 'Analysis of feature usage patterns and trends',
    generate: async (data) => {
      const { usageRecords, features } = data;
      return {
        byFeature: analyzeFeatureUsage(usageRecords, features),
        byTime: analyzeUsageOverTime(usageRecords),
        peakUsage: identifyPeakUsage(usageRecords),
        recommendations: generateUsageRecommendations(usageRecords),
      };
    },
    formatters: {
      csv: (data) => convertToCSV(data),
      pdf: (data) => generatePDFReport(data),
      excel: (data) => generateExcelReport(data),
    },
  },
};
