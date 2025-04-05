import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { WebhookService } from '@/lib/services/webhook-service';

const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event must be selected'),
  description: z.string().optional()
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization for current user
    const organization = await prisma.organization.findFirst({
      where: {
        userOrganizations: {
          some: {
            userId: session.user.id
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Initialize webhook service
    const webhookService = new WebhookService();

    // Get webhook endpoints for organization
    const endpoints = await webhookService.listEndpoints(organization.id);

    return NextResponse.json(endpoints);
  } catch (error) {
    console.error('Error fetching webhook endpoints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook endpoints' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization for current user
    const organization = await prisma.organization.findFirst({
      where: {
        userOrganizations: {
          some: {
            userId: session.user.id
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = createWebhookSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Initialize webhook service
    const webhookService = new WebhookService();

    // Create webhook endpoint
    const endpoint = await webhookService.registerEndpoint(
      organization.id,
      validatedData.data.url,
      validatedData.data.events,
      validatedData.data.description
    );

    return NextResponse.json(endpoint);
  } catch (error) {
    console.error('Error creating webhook endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook endpoint' },
      { status: 500 }
    );
  }
}