import { syncStripeSubscriptions } from "@/lib/cron/sync-stripe-subscriptions";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { vi, test, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("stripe", () => {
  const mockedStripe = {
    subscriptions: {
      list: vi.fn(),
    },
  };
  return {
    default: vi.fn(() => mockedStripe),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test("syncStripeSubscriptions calls the database and the Stripe API", async () => {
  const mockSubscriptions = [
    { id: "sub_1", userId: "user_1", stripeSubscriptionId: "stripe_sub_1", status: "active", currentPeriodEnd: new Date(), currentPeriodStart: new Date(), cancelAt: null, cancelAtPeriodEnd: false, quantity: 1, planId: "plan_1", metadata: {} },
    { id: "sub_2", userId: "user_2", stripeSubscriptionId: "stripe_sub_2", status: "active", currentPeriodEnd: new Date(), currentPeriodStart: new Date(), cancelAt: null, cancelAtPeriodEnd: false, quantity: 1, planId: "plan_1", metadata: {} },
  ];

  const mockStripeSubscriptions = {
    data: [
      { id: "stripe_sub_1", status: "active", current_period_end: 1672531200, current_period_start: 1672531200, cancel_at_period_end: false },
      { id: "stripe_sub_2", status: "canceled", current_period_end: 1672531200, current_period_start: 1672531200, cancel_at_period_end: true },
    ],
  };

  vi.mocked(prisma.subscription.findMany).mockResolvedValue(
    mockSubscriptions as any,
  );
  vi.mocked(Stripe).mockImplementation(() => {
    return {
      subscriptions: {
        list: vi.fn().mockResolvedValue(mockStripeSubscriptions),
      },
    } as any;
  });

  await syncStripeSubscriptions();

  expect(prisma.subscription.findMany).toHaveBeenCalledTimes(1);
  expect(Stripe).toHaveBeenCalledTimes(1);
  expect(prisma.subscription.update).toHaveBeenCalledTimes(2);
  expect(prisma.subscription.update).toHaveBeenNthCalledWith(1, {
    where: { id: "sub_1" },
    data: {
      status: "active",
      currentPeriodEnd: new Date(1672531200 * 1000),
      currentPeriodStart: new Date(1672531200 * 1000),
      cancelAtPeriodEnd: false,
    },
  });
  expect(prisma.subscription.update).toHaveBeenNthCalledWith(2, {
    where: { id: "sub_2" },
    data: {
      status: "canceled",
      currentPeriodEnd: new Date(1672531200 * 1000),
      currentPeriodStart: new Date(1672531200 * 1000),
      cancelAtPeriodEnd: true,
    },
  });
});