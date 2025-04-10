import { prisma } from '@/lib/prisma';
import { ReportType, ReportFormat, SubscriptionStatus } from '@prisma/client';
import { CurrencyService } from './currency-service';
import { TaxService } from './tax-service';

interface ReportParams {
  type: ReportType;
  startDate: Date;
  endDate: Date;
  format?: ReportFormat;
  filters?: Record<string, any>;
  timezone?: string;
  currency?: string;
}

export class ReportingService {
  private readonly currencyService: CurrencyService;
  private readonly taxService: TaxService;

  constructor() {
    this.currencyService = new CurrencyService();
    this.taxService = new TaxService();
  }

  /**
   * Generate a financial report
   */
  public async generateReport(params: ReportParams) {
    const {
      type,
      startDate,
      endDate,
      format = 'JSON',
      filters = {},
      timezone = 'UTC',
      currency = 'USD'
    } = params;

    const reportData = await this.collectReportData(type, startDate, endDate, filters);
    
    // Convert all amounts to requested currency
    await this.normalizeAmounts(reportData, currency);

    // Format report based on type
    const formattedReport = await this.formatReport(reportData, format, timezone);

    // Store report for audit purposes
    await this.storeReport(type, formattedReport, params);

    return formattedReport;
  }

  /**
   * Collect data for report
   */
  private async collectReportData(
    type: ReportType,
    startDate: Date,
    endDate: Date,
    filters: Record<string, any>
  ) {
    switch (type) {
      case 'REVENUE':
        return this.collectRevenueData(startDate, endDate, filters);
      case 'TAX':
        return this.collectTaxData(startDate, endDate, filters);
      case 'SUBSCRIPTION':
        return this.collectSubscriptionData(startDate, endDate, filters);
      case 'CUSTOMER':
        return this.collectCustomerData(startDate, endDate, filters);
      case 'FINANCIAL_STATEMENT':
        return this.collectFinancialStatementData(startDate, endDate, filters);
      default:
        throw new Error(`Unsupported report type: ${type}`);
    }
  }

  /**
   * Collect revenue report data
   */
  private async collectRevenueData(
    startDate: Date,
    endDate: Date,
    filters: Record<string, any>
  ) {
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED',
        ...filters
      },
      include: {
        subscription: {
          include: {
            plan: true
          }
        },
        refunds: true
      }
    });

    const revenue = {
      totalRevenue: 0,
      recurringRevenue: 0,
      oneTimeRevenue: 0,
      refunds: 0,
      netRevenue: 0,
      byCurrency: {} as Record<string, {
        total: number;
        recurring: number;
        oneTime: number;
        refunds: number;
        net: number;
      }>,
      byPlan: {} as Record<string, {
        total: number;
        customers: number;
      }>,
      byMonth: {} as Record<string, {
        total: number;
        recurring: number;
        oneTime: number;
        refunds: number;
      }>
    };

    for (const payment of payments) {
      const { amount, currency } = payment;
      const monthKey = payment.createdAt.toISOString().slice(0, 7);

      // Initialize currency record if needed
      if (!revenue.byCurrency[currency]) {
        revenue.byCurrency[currency] = {
          total: 0,
          recurring: 0,
          oneTime: 0,
          refunds: 0,
          net: 0
        };
      }

      // Initialize month record if needed
      if (!revenue.byMonth[monthKey]) {
        revenue.byMonth[monthKey] = {
          total: 0,
          recurring: 0,
          oneTime: 0,
          refunds: 0
        };
      }

      // Add to totals
      revenue.totalRevenue += amount;
      revenue.byCurrency[currency].total += amount;
      revenue.byMonth[monthKey].total += amount;

      if (payment.subscription) {
        revenue.recurringRevenue += amount;
        revenue.byCurrency[currency].recurring += amount;
        revenue.byMonth[monthKey].recurring += amount;

        // Track by plan
        const planId = payment.subscription.plan.id;
        if (!revenue.byPlan[planId]) {
          revenue.byPlan[planId] = {
            total: 0,
            customers: 0
          };
        }
        revenue.byPlan[planId].total += amount;
        revenue.byPlan[planId].customers++;
      } else {
        revenue.oneTimeRevenue += amount;
        revenue.byCurrency[currency].oneTime += amount;
        revenue.byMonth[monthKey].oneTime += amount;
      }

      // Calculate refunds
      const refundAmount = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
      if (refundAmount > 0) {
        revenue.refunds += refundAmount;
        revenue.byCurrency[currency].refunds += refundAmount;
        revenue.byMonth[monthKey].refunds += refundAmount;
      }
    }

    // Calculate net amounts
    revenue.netRevenue = revenue.totalRevenue - revenue.refunds;
    for (const currency in revenue.byCurrency) {
      revenue.byCurrency[currency].net =
        revenue.byCurrency[currency].total -
        revenue.byCurrency[currency].refunds;
    }

    return revenue;
  }

  /**
   * Collect tax report data
   */
  private async collectTaxData(
    startDate: Date,
    endDate: Date,
    filters: Record<string, any>
  ) {
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'PAID',
        ...filters
      },
      include: {
        organization: true,
        taxRates: true
      }
    });

    const taxData = {
      totalTaxCollected: 0,
      byCountry: {} as Record<string, {
        taxableAmount: number;
        taxAmount: number;
        transactions: number;
      }>,
      byTaxRate: {} as Record<string, {
        rate: number;
        taxableAmount: number;
        taxAmount: number;
        transactions: number;
      }>,
      byMonth: {} as Record<string, {
        taxableAmount: number;
        taxAmount: number;
        transactions: number;
      }>
    };

    for (const invoice of invoices) {
      const country = invoice.organization.country;
      const monthKey = invoice.createdAt.toISOString().slice(0, 7);

      // Initialize records if needed
      if (!taxData.byCountry[country]) {
        taxData.byCountry[country] = {
          taxableAmount: 0,
          taxAmount: 0,
          transactions: 0
        };
      }

      if (!taxData.byMonth[monthKey]) {
        taxData.byMonth[monthKey] = {
          taxableAmount: 0,
          taxAmount: 0,
          transactions: 0
        };
      }

      // Add tax amounts
      const taxAmount = invoice.taxAmount;
      taxData.totalTaxCollected += taxAmount;
      taxData.byCountry[country].taxAmount += taxAmount;
      taxData.byCountry[country].taxableAmount += invoice.subtotal;
      taxData.byCountry[country].transactions++;

      taxData.byMonth[monthKey].taxAmount += taxAmount;
      taxData.byMonth[monthKey].taxableAmount += invoice.subtotal;
      taxData.byMonth[monthKey].transactions++;

      // Track by tax rate
      for (const taxRate of invoice.taxRates) {
        const rateKey = `${taxRate.type}-${taxRate.rate}`;
        if (!taxData.byTaxRate[rateKey]) {
          taxData.byTaxRate[rateKey] = {
            rate: taxRate.rate,
            taxableAmount: 0,
            taxAmount: 0,
            transactions: 0
          };
        }

        const rateTaxAmount = (invoice.subtotal * taxRate.rate) / 100;
        taxData.byTaxRate[rateKey].taxableAmount += invoice.subtotal;
        taxData.byTaxRate[rateKey].taxAmount += rateTaxAmount;
        taxData.byTaxRate[rateKey].transactions++;
      }
    }

    return taxData;
  }

  /**
   * Collect subscription report data
   */
  private async collectSubscriptionData(
    startDate: Date,
    endDate: Date,
    filters: Record<string, any>
  ) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...filters
      },
      include: {
        plan: true,
        organization: true
      }
    });

    const subscriptionData = {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: 0,
      canceledSubscriptions: 0,
      mrr: 0,
      churnRate: 0,
      byPlan: {} as Record<string, {
        active: number;
        canceled: number;
        mrr: number;
      }>,
      byStatus: {} as Record<SubscriptionStatus, number>,
      byMonth: {} as Record<string, {
        new: number;
        canceled: number;
        active: number;
        mrr: number;
      }>
    };

    // Calculate metrics
    for (const subscription of subscriptions) {
      const monthKey = subscription.createdAt.toISOString().slice(0, 7);
      const planId = subscription.plan.id;

      // Initialize records
      if (!subscriptionData.byPlan[planId]) {
        subscriptionData.byPlan[planId] = {
          active: 0,
          canceled: 0,
          mrr: 0
        };
      }

      if (!subscriptionData.byMonth[monthKey]) {
        subscriptionData.byMonth[monthKey] = {
          new: 0,
          canceled: 0,
          active: 0,
          mrr: 0
        };
      }

      // Update counts
      if (subscription.status === 'ACTIVE') {
        subscriptionData.activeSubscriptions++;
        subscriptionData.byPlan[planId].active++;
        subscriptionData.byMonth[monthKey].active++;

        // Calculate MRR
        const monthlyAmount = this.normalizeToMonthlyPrice(
          subscription.plan.basePrice,
          subscription.plan.billingInterval
        );
        subscriptionData.mrr += monthlyAmount;
        subscriptionData.byPlan[planId].mrr += monthlyAmount;
        subscriptionData.byMonth[monthKey].mrr += monthlyAmount;
      } else if (subscription.status === 'CANCELLED') {
        subscriptionData.canceledSubscriptions++;
        subscriptionData.byPlan[planId].canceled++;
        subscriptionData.byMonth[monthKey].canceled++;
      }

      // Track by status
      subscriptionData.byStatus[subscription.status] =
        (subscriptionData.byStatus[subscription.status] || 0) + 1;

      // Track new subscriptions
      if (subscription.createdAt >= startDate && subscription.createdAt <= endDate) {
        subscriptionData.byMonth[monthKey].new++;
      }
    }

    // Calculate churn rate
    const startActive = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: {
          lt: startDate
        }
      }
    });

    if (startActive > 0) {
      subscriptionData.churnRate =
        (subscriptionData.canceledSubscriptions / startActive) * 100;
    }

    return subscriptionData;
  }

  /**
   * Collect customer report data
   */
  private async collectCustomerData(
    startDate: Date,
    endDate: Date,
    filters: Record<string, any>
  ) {
    const customers = await prisma.organization.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...filters
      },
      include: {
        subscriptions: {
          include: {
            plan: true
          }
        },
        payments: {
          where: {
            status: 'COMPLETED'
          }
        }
      }
    });

    const customerData = {
      totalCustomers: customers.length,
      activeCustomers: 0,
      newCustomers: 0,
      churned: 0,
      totalRevenue: 0,
      averageRevenuePerCustomer: 0,
      byCountry: {} as Record<string, {
        total: number;
        active: number;
        revenue: number;
      }>,
      byPlan: {} as Record<string, {
        customers: number;
        revenue: number;
      }>,
      byMonth: {} as Record<string, {
        new: number;
        churned: number;
        active: number;
        revenue: number;
      }>
    };

    for (const customer of customers) {
      const monthKey = customer.createdAt.toISOString().slice(0, 7);
      const country = customer.country;

      // Initialize records
      if (!customerData.byCountry[country]) {
        customerData.byCountry[country] = {
          total: 0,
          active: 0,
          revenue: 0
        };
      }

      if (!customerData.byMonth[monthKey]) {
        customerData.byMonth[monthKey] = {
          new: 0,
          churned: 0,
          active: 0,
          revenue: 0
        };
      }

      // Update counts
      customerData.byCountry[country].total++;

      const hasActiveSubscription = customer.subscriptions.some(
        sub => sub.status === 'ACTIVE'
      );

      if (hasActiveSubscription) {
        customerData.activeCustomers++;
        customerData.byCountry[country].active++;
        customerData.byMonth[monthKey].active++;

        // Track by plan
        for (const subscription of customer.subscriptions) {
          if (subscription.status === 'ACTIVE') {
            const planId = subscription.plan.id;
            if (!customerData.byPlan[planId]) {
              customerData.byPlan[planId] = {
                customers: 0,
                revenue: 0
              };
            }
            customerData.byPlan[planId].customers++;
          }
        }
      }

      // Calculate revenue
      const customerRevenue = customer.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );
      customerData.totalRevenue += customerRevenue;
      customerData.byCountry[country].revenue += customerRevenue;
      customerData.byMonth[monthKey].revenue += customerRevenue;

      // Track by plan
      for (const subscription of customer.subscriptions) {
        if (subscription.status === 'ACTIVE') {
          const planId = subscription.plan.id;
          customerData.byPlan[planId].revenue += customerRevenue;
        }
      }

      // Track new customers
      if (customer.createdAt >= startDate && customer.createdAt <= endDate) {
        customerData.newCustomers++;
        customerData.byMonth[monthKey].new++;
      }
    }

    // Calculate average revenue per customer
    if (customerData.activeCustomers > 0) {
      customerData.averageRevenuePerCustomer =
        customerData.totalRevenue / customerData.activeCustomers;
    }

    // Calculate churned customers
    const churned = await prisma.organization.count({
      where: {
        subscriptions: {
          some: {
            status: 'CANCELLED',
            canceledAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    customerData.churned = churned;

    return customerData;
  }

  /**
   * Collect financial statement data
   */
  private async collectFinancialStatementData(
    startDate: Date,
    endDate: Date,
    filters: Record<string, any>
  ) {
    const [revenue, expenses, transactions] = await Promise.all([
      // Revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Expenses (refunds, payouts, etc.)
      prisma.expense.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      }),

      // All financial transactions
      prisma.financialTransaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          ...filters
        },
        include: {
          category: true
        }
      })
    ]);

    // Build income statement
    const incomeStatement = {
      revenue: {
        total: revenue._sum.amount || 0,
        breakdown: {} as Record<string, number>
      },
      expenses: {
        total: expenses._sum.amount || 0,
        breakdown: {} as Record<string, number>
      },
      netIncome: (revenue._sum.amount || 0) - (expenses._sum.amount || 0),
      byMonth: {} as Record<string, {
        revenue: number;
        expenses: number;
        netIncome: number;
      }>
    };

    // Build balance sheet
    const balanceSheet = {
      assets: {} as Record<string, number>,
      liabilities: {} as Record<string, number>,
      equity: {} as Record<string, number>
    };

    // Categorize transactions
    for (const transaction of transactions) {
      const monthKey = transaction.createdAt.toISOString().slice(0, 7);
      const category = transaction.category.type;
      const amount = transaction.amount;

      // Initialize month record
      if (!incomeStatement.byMonth[monthKey]) {
        incomeStatement.byMonth[monthKey] = {
          revenue: 0,
          expenses: 0,
          netIncome: 0
        };
      }

      // Categorize based on transaction type
      if (category === 'REVENUE') {
        incomeStatement.revenue.breakdown[transaction.category.name] =
          (incomeStatement.revenue.breakdown[transaction.category.name] || 0) + amount;
        incomeStatement.byMonth[monthKey].revenue += amount;
      } else if (category === 'EXPENSE') {
        incomeStatement.expenses.breakdown[transaction.category.name] =
          (incomeStatement.expenses.breakdown[transaction.category.name] || 0) + amount;
        incomeStatement.byMonth[monthKey].expenses += amount;
      }

      // Update monthly net income
      incomeStatement.byMonth[monthKey].netIncome =
        incomeStatement.byMonth[monthKey].revenue -
        incomeStatement.byMonth[monthKey].expenses;

      // Categorize for balance sheet
      if (category === 'ASSET') {
        balanceSheet.assets[transaction.category.name] =
          (balanceSheet.assets[transaction.category.name] || 0) + amount;
      } else if (category === 'LIABILITY') {
        balanceSheet.liabilities[transaction.category.name] =
          (balanceSheet.liabilities[transaction.category.name] || 0) + amount;
      } else if (category === 'EQUITY') {
        balanceSheet.equity[transaction.category.name] =
          (balanceSheet.equity[transaction.category.name] || 0) + amount;
      }
    }

    return {
      incomeStatement,
      balanceSheet
    };
  }

  /**
   * Normalize amounts to requested currency
   */
  private async normalizeAmounts(data: any, targetCurrency: string) {
    const normalizeValue = async (value: number, sourceCurrency: string) => {
      if (sourceCurrency === targetCurrency) {
        return value;
      }
      return this.currencyService.convert(value, sourceCurrency, targetCurrency);
    };

    const normalizeObject = async (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'number' && obj.currency) {
          obj[key] = await normalizeValue(obj[key], obj.currency);
        } else if (typeof obj[key] === 'object') {
          await normalizeObject(obj[key]);
        }
      }
    };

    await normalizeObject(data);
  }

  /**
   * Format report for output
   */
  private async formatReport(
    data: any,
    format: ReportFormat,
    timezone: string
  ) {
    switch (format) {
      case 'JSON':
        return JSON.stringify(data, null, 2);
      case 'CSV':
        return this.convertToCSV(data);
      case 'PDF':
        return this.generatePDFReport(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Store report for audit purposes
   */
  private async storeReport(
    type: ReportType,
    report: string,
    params: ReportParams
  ) {
    await prisma.report.create({
      data: {
        type,
        content: report,
        parameters: params,
        generatedAt: new Date()
      }
    });
  }

  /**
   * Convert report data to CSV format
   */
  private convertToCSV(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    const flatten = (obj: any, prefix = ''): Record<string, any> => {
      return Object.keys(obj).reduce((acc, key) => {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(acc, flatten(value, newKey));
        } else {
          acc[newKey] = value;
        }

        return acc;
      }, {} as Record<string, any>);
    };

    const flatData = flatten(data);
    const headers = Object.keys(flatData);
    const values = headers.map(header => flatData[header]);

    return [
      headers.join(','),
      values.map(value => JSON.stringify(value)).join(',')
    ].join('\n');
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(data: any): Promise<string> {
    // This would be implemented using a PDF generation library
    // For now, return JSON as placeholder
    return JSON.stringify(data, null, 2);
  }

  /**
   * Normalize price to monthly basis
   */
  private normalizeToMonthlyPrice(price: number, interval: string): number {
    switch (interval) {
      case 'yearly':
        return price / 12;
      case 'quarterly':
        return price / 3;
      case 'weekly':
        return price * 4;
      default:
        return price;
    }
  }
}