import { expect } from 'chai';
import * as sinon from 'sinon';
import { AnalyticsService } from '../../services/analytics.service';
import { PrismaClient } from '@prisma/client';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    analyticsService = new AnalyticsService();
    (analyticsService as any).prisma = prisma;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getRevenueMetrics', () => {
    it('should calculate revenue metrics correctly', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-01');

      // Mock subscription count
      const subscriptionCountStub = sinon.stub(prisma.subscription, 'count').resolves(100);

      // Mock payment queries
      const mockPayments = [
        { amount: 100, subscription: { id: '1' } },
        { amount: 200, subscription: { id: '2' } },
        { amount: 150, subscription: null } // One-time payment
      ];

      const paymentFindManyStub = sinon.stub(prisma.payment, 'findMany')
        .onFirstCall().resolves(mockPayments) // Current period
        .onSecondCall().resolves(mockPayments.slice(0, 2)); // Previous period

      // Act
      const metrics = await analyticsService.getRevenueMetrics(startDate, endDate);

      // Assert
      expect(metrics.totalRevenue).to.equal(450);
      expect(metrics.mrr).to.equal(300); // Only recurring payments
      expect(metrics.arr).to.equal(3600); // MRR * 12
      expect(metrics.averageRevenuePerUser).to.equal(3); // MRR / active users
      expect(metrics.revenueGrowth).to.equal(50); // (450 - 300) / 300 * 100

      // Verify stubs were called correctly
      expect(subscriptionCountStub.calledOnce).to.be.true;
      expect(paymentFindManyStub.calledTwice).to.be.true;
    });
  });

  describe('getChurnMetrics', () => {
    it('should calculate churn metrics correctly', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-01');

      // Mock subscription queries
      const subscriptionCountStub = sinon.stub(prisma.subscription, 'count');
      subscriptionCountStub
        .onFirstCall().resolves(10) // Churned subscriptions
        .onSecondCall().resolves(100); // Total subscriptions

      const mockChurningSubscriptions = [
        { plan: { currentPrice: 100 } },
        { plan: { currentPrice: 200 } }
      ];

      const subscriptionFindManyStub = sinon.stub(prisma.subscription, 'findMany')
        .resolves(mockChurningSubscriptions);

      // Act
      const metrics = await analyticsService.getChurnMetrics(startDate, endDate);

      // Assert
      expect(metrics.churnRate).to.equal(10); // (10 / 100) * 100
      expect(metrics.retentionRate).to.equal(90); // 100 - churnRate
      expect(metrics.churningMRR).to.equal(300); // Sum of churning subscription prices
      expect(metrics.churnedSubscriptions).to.equal(10);
      expect(metrics.totalChurned).to.equal(10);

      // Verify stubs were called correctly
      expect(subscriptionCountStub.calledTwice).to.be.true;
      expect(subscriptionFindManyStub.calledOnce).to.be.true;
    });

    it('should handle zero total subscriptions', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-01');

      sinon.stub(prisma.subscription, 'count').resolves(0);
      sinon.stub(prisma.subscription, 'findMany').resolves([]);

      // Act
      const metrics = await analyticsService.getChurnMetrics(startDate, endDate);

      // Assert
      expect(metrics.churnRate).to.equal(0);
      expect(metrics.retentionRate).to.equal(100);
      expect(metrics.churningMRR).to.equal(0);
    });
  });

  describe('getSubscriptionMetrics', () => {
    it('should calculate subscription metrics correctly', async () => {
      // Arrange
      const subscriptionCountStub = sinon.stub(prisma.subscription, 'count');
      
      // Set up counts for different subscription statuses
      subscriptionCountStub
        .onFirstCall().resolves(50)  // Active
        .onSecondCall().resolves(20) // Trial
        .onThirdCall().resolves(10)  // Canceled
        .onCall(3).resolves(80)      // Total
        .onCall(4).resolves(30)      // Converted trials
        .onCall(5).resolves(10);     // Canceled trials

      // Act
      const metrics = await analyticsService.getSubscriptionMetrics();

      // Assert
      expect(metrics.totalSubscriptions).to.equal(80);
      expect(metrics.activeSubscriptions).to.equal(50);
      expect(metrics.trialSubscriptions).to.equal(20);
      expect(metrics.canceledSubscriptions).to.equal(10);
      expect(metrics.conversionRate).to.equal(75); // (30 / 40) * 100

      // Verify stub was called correct number of times
      expect(subscriptionCountStub.callCount).to.equal(6);
    });

    it('should handle zero completed trials', async () => {
      // Arrange
      const subscriptionCountStub = sinon.stub(prisma.subscription, 'count');
      subscriptionCountStub
        .onFirstCall().resolves(50)  // Active
        .onSecondCall().resolves(20) // Trial
        .onThirdCall().resolves(10)  // Canceled
        .onCall(3).resolves(80)      // Total
        .onCall(4).resolves(0)       // Converted trials
        .onCall(5).resolves(0);      // Canceled trials

      // Act
      const metrics = await analyticsService.getSubscriptionMetrics();

      // Assert
      expect(metrics.conversionRate).to.equal(0);
    });
  });

  describe('generateRevenueReport', () => {
    it('should generate a complete revenue report', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-01');

      // Mock the individual metric methods
      const revenueMetrics = {
        mrr: 1000,
        arr: 12000,
        totalRevenue: 1500,
        revenueGrowth: 10,
        averageRevenuePerUser: 100
      };

      const churnMetrics = {
        churnRate: 5,
        retentionRate: 95,
        churningMRR: 50,
        churnedSubscriptions: 2,
        totalChurned: 2
      };

      const subscriptionMetrics = {
        totalSubscriptions: 100,
        activeSubscriptions: 80,
        trialSubscriptions: 15,
        canceledSubscriptions: 5,
        conversionRate: 70
      };

      sinon.stub(analyticsService, 'getRevenueMetrics').resolves(revenueMetrics);
      sinon.stub(analyticsService, 'getChurnMetrics').resolves(churnMetrics);
      sinon.stub(analyticsService, 'getSubscriptionMetrics').resolves(subscriptionMetrics);

      const reportCreateStub = sinon.stub(prisma.report, 'create').resolves({
        id: 'report-1',
        type: 'REVENUE',
        format: 'JSON',
        status: 'COMPLETED',
        createdBy: 'SYSTEM',
        metadata: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          revenue: revenueMetrics,
          churn: churnMetrics,
          subscriptions: subscriptionMetrics
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        downloadUrl: null
      });

      // Act
      const report = await analyticsService.generateRevenueReport(startDate, endDate);

      // Assert
      expect(report.type).to.equal('REVENUE');
      expect(report.status).to.equal('COMPLETED');
      expect(report.metadata).to.deep.include({
        revenue: revenueMetrics,
        churn: churnMetrics,
        subscriptions: subscriptionMetrics
      });

      expect(reportCreateStub.calledOnce).to.be.true;
    });
  });
});