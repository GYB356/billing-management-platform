import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handle from '../../../app/api/subscriptions/route';
import { IInvoiceService } from '../../../lib/services/invoice-service';
import { IUsageService } from '../../../lib/services/usage-service';
import { IPrisma } from '../../../lib/prisma';
import { IStripe } from '../../../lib/stripe';
import { IEventManager } from '../../../lib/events';
import { IBackgroundJobManager } from '../../../lib/background-jobs/background-job-manager';
import { IBackgroundJob } from '../../../lib/background-jobs/background-job';
import { IConfig } from '../../../lib/config';

jest.mock('../../../lib/prisma');
jest.mock('../../../lib/stripe');

const mockInvoiceService: jest.Mocked<IInvoiceService> = {
  createInvoice: jest.fn(),
  getInvoice: jest.fn(),
  updateInvoice: jest.fn(),
  deleteInvoice: jest.fn(),
  getInvoices: jest.fn(),
  finalizeInvoice: jest.fn(),
  markInvoiceAsPaid: jest.fn(),
  createCreditNote: jest.fn(),
  getCreditNote: jest.fn(),
  updateCreditNote: jest.fn(),
  deleteCreditNote: jest.fn(),
  listCreditNotes: jest.fn(),
  applyCreditNote: jest.fn(),
  createInvoiceFromSubscription: jest.fn(),
};

const mockUsageService: jest.Mocked<IUsageService> = {
  recordUsage: jest.fn(),
  getUsageSummary: jest.fn(),
  getUsageDetails: jest.fn(),
  getSubscriptionUsage: jest.fn(),
  createUsageRecord: jest.fn(),
  getUsageRecord: jest.fn(),
  updateUsageRecord: jest.fn(),
  deleteUsageRecord: jest.fn(),
  listUsageRecords: jest.fn(),
  getUsageBreakdown: jest.fn(),
  createUsageAlert: jest.fn(),
  getUsageAlert: jest.fn(),
  updateUsageAlert: jest.fn(),
  deleteUsageAlert: jest.fn(),
  listUsageAlerts: jest.fn(),
};

const mockPrisma: jest.Mocked<IPrisma> = {
  subscription: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  customer: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  price: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  invoice: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  usageRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  usageAlert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockStripe: jest.Mocked<IStripe> = {
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
  products: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
  prices: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
  invoices: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
  paymentMethods: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  },
};

const mockEventManager: jest.Mocked<IEventManager> = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockBackgroundJobManager: jest.Mocked<IBackgroundJobManager> = {
  addJob: jest.fn(),
  getJob: jest.fn(),
  removeJob: jest.fn(),
  getJobs: jest.fn(),
  getQueue: jest.fn(),
  pauseQueue: jest.fn(),
  resumeQueue: jest.fn(),
  flushQueue: jest.fn(),
};

const mockBackgroundJob: jest.Mocked<IBackgroundJob> = {
  name: 'mockJob',
  data: {},
  schedule: jest.fn(),
  run: jest.fn(),
  retry: jest.fn(),
  fail: jest.fn(),
  cancel: jest.fn(),
  progress: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
};

const mockConfig: jest.Mocked<IConfig> = {
  getConfig: jest.fn(),
};

describe('Subscriptions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle GET requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handle(
      req,
      res,
      mockInvoiceService,
      mockUsageService,
      mockPrisma,
      mockStripe,
      mockEventManager,
      mockBackgroundJobManager,
      mockBackgroundJob,
      mockConfig,
    );
    expect(res._getStatusCode()).toBe(200);
  });

  it('should handle POST requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
    });

    await handle(
      req,
      res,
      mockInvoiceService,
      mockUsageService,
      mockPrisma,
      mockStripe,
      mockEventManager,
      mockBackgroundJobManager,
      mockBackgroundJob,
      mockConfig,
    );
    expect(res._getStatusCode()).toBe(200);
  });

  it('should handle PUT requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'PUT',
    });

    await handle(
      req,
      res,
      mockInvoiceService,
      mockUsageService,
      mockPrisma,
      mockStripe,
      mockEventManager,
      mockBackgroundJobManager,
      mockBackgroundJob,
      mockConfig,
    );
    expect(res._getStatusCode()).toBe(200);
  });

  it('should handle DELETE requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'DELETE',
    });

    await handle(
      req,
      res,
      mockInvoiceService,
      mockUsageService,
      mockPrisma,
      mockStripe,
      mockEventManager,
      mockBackgroundJobManager,
      mockBackgroundJob,
      mockConfig,
    );
    expect(res._getStatusCode()).toBe(200);
  });

  it('should handle unsupported methods', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'PATCH',
    });

    await handle(
      req,
      res,
      mockInvoiceService,
      mockUsageService,
      mockPrisma,
      mockStripe,
      mockEventManager,
      mockBackgroundJobManager,
      mockBackgroundJob,
      mockConfig,
    );
    expect(res._getStatusCode()).toBe(405);
  });
});