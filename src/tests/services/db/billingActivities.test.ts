import { prisma } from '../../../lib/prisma';
import {
  getWeeklyBillingActivities,
  createBillingActivity,
  getCustomerBillingActivities
} from '../../../services/db/billingActivities';
import { DeepMockProxy } from 'jest-mock-extended';

// Get the mocked prisma client
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  prisma: {
    billingActivity: {
      findMany: jest.fn(),
      create: jest.fn()
    }
  }
}));

describe('Billing Activities Database Layer', () => {
  const mockPrisma = prisma as unknown as DeepMockProxy<typeof prisma>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeeklyBillingActivities', () => {
    it('should fetch activities from the past week', async () => {
      const mockActivities = [
        {
          id: '1',
          timestamp: new Date(),
          amount: 100,
          description: 'Test',
          status: 'success',
          customerId: 'customer1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.billingActivity.findMany.mockResolvedValue(mockActivities);

      const result = await getWeeklyBillingActivities();

      expect(result).toEqual(mockActivities);
      expect(mockPrisma.billingActivity.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: expect.any(Date)
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
    });
  });

  describe('createBillingActivity', () => {
    it('should create new billing activity', async () => {
      const mockActivity = {
        amount: 100,
        description: 'Test activity',
        status: 'success',
        customerId: 'customer1'
      };

      const mockCreatedActivity = {
        ...mockActivity,
        id: '1',
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.billingActivity.create.mockResolvedValue(mockCreatedActivity);

      const result = await createBillingActivity(mockActivity);

      expect(result).toEqual(mockCreatedActivity);
      expect(mockPrisma.billingActivity.create).toHaveBeenCalledWith({
        data: {
          ...mockActivity,
          timestamp: expect.any(Date)
        }
      });
    });
  });

  describe('getCustomerBillingActivities', () => {
    it('should fetch activities for specific customer', async () => {
      const customerId = 'customer1';
      const mockActivities = [
        {
          id: '1',
          timestamp: new Date(),
          amount: 100,
          description: 'Test',
          status: 'success',
          customerId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.billingActivity.findMany.mockResolvedValue(mockActivities);

      const result = await getCustomerBillingActivities(customerId);

      expect(result).toEqual(mockActivities);
      expect(mockPrisma.billingActivity.findMany).toHaveBeenCalledWith({
        where: {
          customerId
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
    });

    it('should return empty array when no activities found', async () => {
      mockPrisma.billingActivity.findMany.mockResolvedValue([]);

      const result = await getCustomerBillingActivities('non-existent');

      expect(result).toEqual([]);
    });
  });
}); 