import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WebhookService } from '@/lib/services/webhook-service';

export async function GET(
  request: Request,
  { params }: { params: { endpointId: string } }
) {
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

    // Verify endpoint belongs to organization
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id: params.endpointId,
        organizationId: organization.id
      }
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    // Initialize webhook service
    const webhookService = new WebhookService();

    // Get delivery history
    const deliveries = await webhookService.getDeliveryHistory(endpoint.id);

    return NextResponse.json(deliveries);
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook deliveries' },
      { status: 500 }
    );
  }
}