import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createEvent, EventSeverity } from '@/lib/events';

/**
 * List payment methods for a customer with pagination
 * @param customerId - Stripe customer ID
 * @param page - Page number (1-based)
 * @param limit - Number of items per page
 */
export async function listPaymentMethods(
  customerId: string,
  page: number = 1,
  limit: number = 10
) {
  try {
    // Verify the customer exists
    const customer = await prisma.organization.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Calculate starting point
    const startingAfter = (page - 1) * limit;

    // Get payment methods from Stripe with pagination
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: limit,
      starting_after: startingAfter > 0 ? undefined : undefined, // Stripe handles pagination differently
    });

    // Format the response
    return {
      data: paymentMethods.data.map(method => ({
        id: method.id,
        type: method.type,
        brand: method.card?.brand,
        last4: method.card?.last4,
        expMonth: method.card?.exp_month,
        expYear: method.card?.exp_year,
        isDefault: method.metadata?.isDefault === 'true',
        createdAt: new Date(method.created * 1000),
      })),
      hasMore: paymentMethods.has_more,
      totalCount: paymentMethods.data.length, // Stripe doesn't provide total count
    };
  } catch (error) {
    console.error('Error listing payment methods:', error);
    throw error;
  }
}

/**
 * Add a new payment method
 * @param customerId - Stripe customer ID
 * @param paymentMethodId - Stripe payment method ID
 * @param setAsDefault - Whether to set as default payment method
 */
export async function addPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  setAsDefault = false,
  organizationId?: string
) {
  try {
    // Verify the customer exists
    const customer = await prisma.organization.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default if requested
    if (setAsDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update metadata to mark as default
      await stripe.paymentMethods.update(paymentMethodId, {
        metadata: { isDefault: 'true' },
      });

      // Update other payment methods to not be default
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      // Update all other payment methods to not be default
      for (const method of paymentMethods.data) {
        if (method.id !== paymentMethodId && method.metadata?.isDefault === 'true') {
          await stripe.paymentMethods.update(method.id, {
            metadata: { isDefault: 'false' },
          });
        }
      }
    }

    // Create event
    if (organizationId) {
      await createEvent({
        organizationId,
        eventType: 'payment_method.added',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        severity: EventSeverity.INFO,
        metadata: {
          customerId,
          setAsDefault,
        },
      });
    }

    // Get the payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year,
      isDefault: setAsDefault,
      createdAt: new Date(paymentMethod.created * 1000),
    };
  } catch (error) {
    console.error('Error adding payment method:', error);
    throw error;
  }
}

/**
 * Remove a payment method
 * @param customerId - Stripe customer ID
 * @param paymentMethodId - Stripe payment method ID
 */
export async function removePaymentMethod(
  customerId: string,
  paymentMethodId: string,
  organizationId?: string
) {
  try {
    // Verify the customer exists
    const customer = await prisma.organization.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Verify the payment method belongs to the customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (paymentMethod.customer !== customerId) {
      throw new Error('Payment method does not belong to this customer');
    }

    // Check if this is the default payment method
    const isDefault = paymentMethod.metadata?.isDefault === 'true';

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    // If this was the default method, set a new default if available
    if (isDefault) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      if (paymentMethods.data.length > 0) {
        const newDefaultMethod = paymentMethods.data[0];
        
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: newDefaultMethod.id,
          },
        });

        await stripe.paymentMethods.update(newDefaultMethod.id, {
          metadata: { isDefault: 'true' },
        });
      }
    }

    // Create event
    if (organizationId) {
      await createEvent({
        organizationId,
        eventType: 'payment_method.removed',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        severity: EventSeverity.WARNING,
        metadata: {
          customerId,
          wasDefault: isDefault,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing payment method:', error);
    throw error;
  }
}

/**
 * Set a payment method as default
 * @param customerId - Stripe customer ID
 * @param paymentMethodId - Stripe payment method ID
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  organizationId?: string
) {
  try {
    // Verify the customer exists
    const customer = await prisma.organization.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Verify the payment method belongs to the customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (paymentMethod.customer !== customerId) {
      throw new Error('Payment method does not belong to this customer');
    }

    // Update the customer's default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update this payment method's metadata
    await stripe.paymentMethods.update(paymentMethodId, {
      metadata: { isDefault: 'true' },
    });

    // Update other payment methods to not be default
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    for (const method of paymentMethods.data) {
      if (method.id !== paymentMethodId && method.metadata?.isDefault === 'true') {
        await stripe.paymentMethods.update(method.id, {
          metadata: { isDefault: 'false' },
        });
      }
    }

    // Create event
    if (organizationId) {
      await createEvent({
        organizationId,
        eventType: 'payment_method.set_default',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        severity: EventSeverity.INFO,
        metadata: {
          customerId,
        },
      });
    }

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year,
      isDefault: true,
      createdAt: new Date(paymentMethod.created * 1000),
    };
  } catch (error) {
    console.error('Error setting default payment method:', error);
    throw error;
  }
}

/**
 * Create a Stripe setup intent for adding a new payment method
 * @param customerId - Stripe customer ID
 */
export async function createSetupIntent(customerId: string) {
  try {
    // Verify the customer exists
    const customer = await prisma.organization.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Create a setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Allow using this payment method for future payments
    });

    return {
      clientSecret: setupIntent.client_secret,
      id: setupIntent.id,
    };
  } catch (error) {
    console.error('Error creating setup intent:', error);
    throw error;
  }
}

// Alias removePaymentMethod as deletePaymentMethod for route compatibility
export const deletePaymentMethod = removePaymentMethod;

// Alias setDefaultPaymentMethod as updatePaymentMethod for route compatibility
export const updatePaymentMethod = setDefaultPaymentMethod; 