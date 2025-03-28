import { prisma } from '../lib/prisma';
import { createCoupon } from '../lib/promotions';
import { createTrialSubscription, processTrialReminders, processExpiredTrials } from '../lib/trials';
import { stripe } from '../lib/stripe';
import { randomUUID } from 'crypto';

async function testCouponRedemption() {
  console.log("\n--- Testing Coupon Redemption ---");
  
  // 1. Create a test promotion
  const testPromotion = await prisma.promotion.create({
    data: {
      name: "Test Promotion",
      description: "Test promotion for integration testing",
      discountType: "PERCENTAGE",
      discountAmount: 10, // 10% discount
      active: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      maxRedemptions: 100,
      applicablePlans: ["basic", "pro"],
    }
  });
  
  console.log(`Created test promotion: ${testPromotion.id}`);
  
  // 2. Create a test coupon
  const couponCode = `TEST${Math.floor(Math.random() * 10000)}`;
  const testCoupon = await createCoupon({
    promotionId: testPromotion.id,
    code: couponCode,
    maxRedemptions: 50
  });
  
  console.log(`Created test coupon: ${testCoupon.code}`);
  
  // 3. Test coupon validation through API
  try {
    const response = await fetch('http://localhost:3000/api/coupons', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        code: couponCode,
        planId: 'basic'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to validate coupon: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Coupon validation response:", data);
    
    if (data.valid) {
      console.log("✅ Coupon validation successful");
    } else {
      console.log("❌ Coupon validation failed");
    }
  } catch (error) {
    console.error("Error validating coupon:", error);
  }
}

async function testTrialSignup() {
  console.log("\n--- Testing Trial Signup ---");
  
  // 1. Create a test organization
  const testOrg = await prisma.organization.create({
    data: {
      name: `Test Organization ${randomUUID().slice(0, 8)}`,
      email: `test-${randomUUID().slice(0, 8)}@example.com`,
    }
  });
  
  console.log(`Created test organization: ${testOrg.id}`);
  
  // 2. Get a pricing plan
  const plan = await prisma.pricingPlan.findFirst({
    where: { active: true }
  });
  
  if (!plan) {
    console.error("No active pricing plans found. Please create one first.");
    return;
  }
  
  console.log(`Using pricing plan: ${plan.id} (${plan.name})`);
  
  // 3. Create a trial subscription
  try {
    const trial = await createTrialSubscription({
      organizationId: testOrg.id,
      planId: plan.id,
      trialDays: 14
    });
    
    console.log(`Created trial subscription: ${trial.id}`);
    console.log(`Trial period: ${trial.trialStart} to ${trial.trialEnd}`);
    console.log("✅ Trial signup successful");
    
    // 4. Test trial reminders
    await processTrialReminders();
    console.log("✅ Trial reminders processed");
    
  } catch (error) {
    console.error("Error creating trial subscription:", error);
  }
}

async function testOneTimePayment() {
  console.log("\n--- Testing One-Time Payment ---");
  
  // 1. Create a test organization if needed
  const testOrg = await prisma.organization.findFirst();
  
  if (!testOrg) {
    console.error("No organizations found. Please create one first.");
    return;
  }
  
  if (!testOrg.stripeCustomerId) {
    // Create Stripe customer
    const customer = await stripe.customers.create({
      name: testOrg.name,
      email: testOrg.email || undefined,
      metadata: {
        organizationId: testOrg.id,
      },
    });
    
    await prisma.organization.update({
      where: { id: testOrg.id },
      data: { stripeCustomerId: customer.id }
    });
    
    console.log(`Created Stripe customer for org: ${customer.id}`);
  }
  
  // 2. Create a payment intent
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2500, // $25.00
      currency: 'usd',
      customer: testOrg.stripeCustomerId!,
      metadata: {
        organizationId: testOrg.id,
        description: 'Test one-time payment',
      },
    });
    
    console.log(`Created payment intent: ${paymentIntent.id}`);
    
    // 3. Create database record
    const payment = await prisma.oneTimePayment.create({
      data: {
        organizationId: testOrg.id,
        amount: 2500,
        currency: 'usd',
        description: 'Test one-time payment',
        status: 'PENDING',
        stripeId: paymentIntent.id,
        metadata: { test: true }
      }
    });
    
    console.log(`Created one-time payment record: ${payment.id}`);
    console.log("✅ One-time payment setup successful");
    
    // Note: In a real test, we would need to use Stripe's test cards to complete the payment
    console.log("Note: To complete payment, use Stripe test card: 4242 4242 4242 4242");
    
  } catch (error) {
    console.error("Error setting up one-time payment:", error);
  }
}

async function runTests() {
  try {
    console.log("Starting billing integration tests...");
    
    await testCouponRedemption();
    await testTrialSignup();
    await testOneTimePayment();
    
    console.log("\n✅ All tests completed");
  } catch (error) {
    console.error("Test execution error:", error);
  } finally {
    // Clean up if needed
    await prisma.$disconnect();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 