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



export const config = { api: { bodyParser: false } }


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
        const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;
        if (!webhookSecret) {
            return handleApiError(createErrorResponse('Webhook secret not configured', 500, 'WEBHOOK_SECRET_NOT_CONFIGURED'));
        }
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');
        let stripeEvent: Event;
        try {
            if (!signature) {
                throw new Error('Missing stripe-signature header');
            }            
            stripeEvent = StripeService.webhooks.constructEvent(
                rawBody,
                signature,
                webhookSecret
            );
        } catch (error) {
            return handleApiError(createFormattedErrorResponse('Webhook Error: Invalid signature', 400));

        }
        // Handle the event based on its type
        
        switch (stripeEvent.type) {
            case 'customer.subscription.updated':                
                const subscription = stripeEvent.data.object;
                console.log('subscription updated:', subscription);
                // Then define and call a function to handle the event customer.subscription.updated
                break;
            case 'invoice.payment_failed':
                const invoice = stripeEvent.data.object;
                console.log('invoice payment failed:', invoice);
                // Then define and call a function to handle the event invoice.payment_failed
                break;
            // ... handle other event types
            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
                
                break;
        }
        return createSuccessResponse({ received: true });        
    } 
}
// POST /api/webhooks - Create webhook
export async function POST(req: NextRequest) {
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
 export async function PATCH(
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