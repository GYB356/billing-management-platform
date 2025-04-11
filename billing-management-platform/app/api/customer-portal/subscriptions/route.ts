import { getTaxRateForUser } from "@/lib/tax";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      customerId,
      organizationId,
      planId,
      quantity = 1,
      billingCycle = 'monthly',
      trialDays,
      paymentMethodId,
    } = body;

    if (!customerId || !organizationId || !planId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create or retrieve Stripe customer
    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      include: {
        address: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get tax rate for customer
    const taxRate = await getTaxRateForUser(
      customerId,
      customer.address?.country || 'US',
      customer.address?.region
    );

    // Get plan details
    const plan = await prisma.plan.findUnique({
      where: { stripeId: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Calculate tax amount
    const baseAmount = plan.price * quantity;
    const taxAmount = Math.floor(baseAmount * taxRate);
    const totalAmount = baseAmount + taxAmount;

    let stripeCustomerId = customer.metadata?.stripeCustomerId;
    // ... rest of the existing customer creation code ...

    // Create Stripe subscription with tax
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: { name: plan.name },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      trial_period_days: trialDays,
      metadata: {
        baseAmount: baseAmount.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmount.toString(),
      },
    });

    // Create tax history record
    await prisma.taxHistory.create({
      data: {
        userId: customerId,
        rate: taxRate,
        country: customer.address?.country || 'US',
        region: customer.address?.region,
      },
    });

    // ... rest of the existing subscription creation code ...
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 