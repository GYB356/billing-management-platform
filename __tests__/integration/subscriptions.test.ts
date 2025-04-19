import { SubscriptionService } from "../../../lib/services/subscription-service";
import { IInvoiceService } from "../../../lib/services/invoice-service";
import { IUsageService } from "../../../lib/services/usage-service";
import { IPrisma } from "../../../lib/prisma";
import { IStripe } from "../../../lib/stripe";
import { IEventManager } from "../../../lib/events";
import { IBackgroundJobManager } from "../../../lib/background-jobs/background-job-manager";
import { IBackgroundJob } from "../../../lib/background-jobs/background-job";
import { IConfig } from "../../../lib/config";

describe("SubscriptionService", () => {
  let subscriptionService: SubscriptionService;
  let mockInvoiceService: jest.Mocked<IInvoiceService>;
  let mockUsageService: jest.Mocked<IUsageService>;
  let mockPrisma: jest.Mocked<IPrisma>;
  let mockStripe: jest.Mocked<IStripe>;
  let mockEventManager: jest.Mocked<IEventManager>;
  let mockBackgroundJobManager: jest.Mocked<IBackgroundJobManager>;
  let mockBackgroundJob: jest.Mocked<IBackgroundJob>;
  let mockConfig: jest.Mocked<IConfig>;

  beforeEach(() => {
    mockInvoiceService = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      getInvoices: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      listInvoices: jest.fn(),
      markAsPaid: jest.fn(),
      markAsUncollectible: jest.fn(),
      refundInvoice: jest.fn(),
      retryInvoice: jest.fn(),
    } as jest.Mocked<IInvoiceService>;

    mockUsageService = {
      recordUsage: jest.fn(),
      getUsage: jest.fn(),
      getUsageSummary: jest.fn(),
    } as jest.Mocked<IUsageService>;

    mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      subscriptionItem: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<IPrisma>;

    mockStripe = {
      customers: {
        create: jest.fn(),
      },
      subscriptions: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<IStripe>;

    mockEventManager = {
      emit: jest.fn(),
      on: jest.fn(),
    } as jest.Mocked<IEventManager>;

    mockBackgroundJobManager = {
        addJob: jest.fn(),
        processJobs: jest.fn(),
        removeJob: jest.fn(),
        getJob: jest.fn(),
    } as jest.Mocked<IBackgroundJobManager>;

    mockBackgroundJob = {
        create: jest.fn(),
    } as jest.Mocked<IBackgroundJob>;

    mockConfig = {
        getConfig: jest.fn().mockReturnValue({}),
    } as jest.Mocked<IConfig>;

    subscriptionService = new SubscriptionService(
      mockInvoiceService,
      mockUsageService,
      mockPrisma,
      mockStripe,
      mockEventManager,
      mockBackgroundJobManager,
      mockConfig,
    );
  });

  it("should be defined", () => {
    expect(subscriptionService).toBeDefined();
  });
});