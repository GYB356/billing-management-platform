import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Event } from 'stripe';
import crypto from 'crypto';
import { handleApiError } from '@/lib/utils/error-handling';
import { createSuccessResponse, createErrorResponse as createFormattedErrorResponse } from '@/lib/utils/response-format';
import * as StripeService from '@/lib/stripe';
import { retryOperation } from '@/lib/utils/retry';
import { addToDeadLetterQueue } from '@/lib/utils/dead-letter-queue';
import { rateLimit } from '@/lib/utils/rate-limit';
import { backgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { BackgroundJob } from '@/lib/background-jobs/background-job';
import { LogLevel } from '@/lib/config';
import { Config } from '@/lib/config';



export const config = { api: { bodyParser: false } }

const processedEvents = new Set<string>();


const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
  organizationId: z.string(),
  description: z.string().optional(),
  secret: z.string().optional(),
});



// Validation schema for webhook updates
const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

// Generate a secure webhook secret
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// GET /api/webhooks - List webhooks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
      try{
        z.string().parse(organizationId);
      } catch (error){
          return createFormattedErrorResponse({ message: 'Invalid Organization ID' }, 400);
      }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createFormattedErrorResponse({ message: 'Unauthorized' }, 401);
    }
    if (!organizationId) {
      return createFormattedErrorResponse({ message: 'Organization ID is required' }, 400);
    }

    const webhooks = await prisma.webhook.findMany({
      where: { organizationId },
      select: {
        id: true,
        url: true,
        events: true,
        status: true,
        lastSuccess: true,
        lastFailure: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return createSuccessResponse(webhooks);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/webhooks - Handle stripe webhooks and Create webhook

export async function POST(req: NextRequest){
    if (req.headers.get('stripe-signature')){
        const config = Config.getConfig();
        const webhookSecret = config.webhookSecret;
        if (!webhookSecret) {
            return handleApiError(createErrorResponse('Webhook secret not configured', 500, 'WEBHOOK_SECRET_NOT_CONFIGURED'));
        }
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');
        let stripeEvent: Event;
        try {
            stripeEvent = StripeService.webhooks.constructEvent(
                rawBody,
                signature,
                webhookSecret
            );
            
        } catch (error) {
            return handleApiError(createFormattedErrorResponse('Webhook Error: Invalid signature', 400));

        }
        if (processedEvents.has(stripeEvent.id)) {
            console.log(`Ignoring already processed event: ${stripeEvent.id}`);
            return createSuccessResponse({ received: true });
        }
        processedEvents.add(stripeEvent.id);
        try {
            await retryOperation(async () => {
                try{
                    const config = Config.getConfig()
                    switch (stripeEvent.type) {
                        case 'customer.subscription.updated':                
                            const subscription = stripeEvent.data.object as StripeService.Stripe.Subscription;
                            console.log('subscription updated:', subscription);
                            // Then define and call a function to handle the event customer.subscription.updated
                            break;
                        case 'customer.subscription.created':
                            const newSubscription = stripeEvent.data.object as StripeService.Stripe.Subscription;
                            const userId = newSubscription.metadata.userId;
                            const user = await prisma.user.findUnique({where: {id: userId}})
                            if (!user) {
                                throw new Error('User not found');
                            }
                            const sendWelcomeEmailJob = BackgroundJob.create('send-welcome-email', { user, subscription: newSubscription }, async (data) => {
                                await import('@/lib/cron/send-welcome-email').then(module => module.handleSendWelcomeEmail(data.user, data.subscription));
                            });
                            backgroundJobManager.addJob(sendWelcomeEmailJob);
                            break;
                        case 'invoice.payment_failed':
                            const invoice = stripeEvent.data.object as StripeService.Stripe.Invoice;
                            console.log('invoice payment failed:', invoice)
                            // Then define and call a function to handle the event invoice.payment_failed
                            break;
                        // ... handle other event types
                        default:
                            console.log(`Unhandled event type: ${stripeEvent.type}`);
                            
                            break;
                    }
                } catch (error) {

                    if (error instanceof z.ZodError) {
                        return createFormattedErrorResponse(
                            { message: 'Invalid request data', details: error.errors },
                            400
                        );
                    }
                    if(config.logLevel === LogLevel.DEBUG){
                        console.error(error)
                    } else {
                        console.log('An error ocurred in the webhooks')
                    }
                    throw error;
                }
            }, 3, 1000).catch(error => {
                console.error('Error processing webhook event after retries:', error);
                addToDeadLetterQueue(stripeEvent.id, stripeEvent);
            });
        } catch(error) {
            console.error('Error processing webhook event:', error);
        }
        return createSuccessResponse({ received: true });        
    } 
// POST /api/webhooks - Create webhook
export async function POST(req: NextRequest) {
    const rateLimitResult = rateLimit('webhook');
    if (!rateLimitResult.success) {
        return handleApiError(createFormattedErrorResponse({ message: 'Rate limit exceeded' }, 429));
    }
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return createFormattedErrorResponse({ message: 'Unauthorized' }, 401);
        }
        const body = await req.json();
        const validatedData = createWebhookSchema.parse(body);
        const webhook = await prisma.webhook.create({
            data: {
                ...validatedData,
                secret: validatedData.secret || generateWebhookSecret(),
                status: 'ACTIVE',
                retryConfig: {
                    maxAttempts: 3,
                    initialDelay: 5000,
                    maxDelay: 60000,
                    backoffMultiplier: 2,
                },
                organization: {
                    connect: { id: body.organizationId },
                },
            },
        });

    return createSuccessResponse(webhook);
  } catch (error) {
        if (error instanceof z.ZodError) {
            return createFormattedErrorResponse({ message: 'Invalid request data', details: error.errors }, 400);
        }
    return handleApiError(error);    
  }

}
// PATCH /api/webhooks/[id] - Update webhook
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return createFormattedErrorResponse({ message: 'Unauthorized' }, 401);
    }

    const body = await req.json();
      let validatedData;
      try{
          validatedData = updateWebhookSchema.parse(body);
      } catch (error){
          return createFormattedErrorResponse({ message: 'Invalid request data', details: error.errors }, 400);
      }

    const webhook = await prisma.webhook.update({
      where: { id: params.id },
      data: validatedData,
    });

    return createSuccessResponse(webhook);
  } catch (error) {
        if (error instanceof z.ZodError) {
            return createFormattedErrorResponse({ message: 'Invalid request data', details: error.errors }, 400);
        }
  }
    return handleApiError(error);
}

// DELETE /api/webhooks/[id] - Delete webhook
 export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return createFormattedErrorResponse({ message: 'Unauthorized' }, 401);
    }

    await prisma.webhook.delete({
      where: { id: params.id },
    });

    return createSuccessResponse(null);
  } catch (error) {
    return handleApiError(error);
    
  }
}