import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WebhookService } from '@/lib/services/webhook-service';

export async function POST(
  request: Request,
  { params }: { params: { deliveryId: string } }
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

    // Get the webhook delivery
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: params.deliveryId },
      include: {
        endpoint: true
      }
    });

    if (!delivery) {
      return NextResponse.json(
        { error: 'Webhook delivery not found' },
        { status: 404 }
      );
    }

    // Verify endpoint belongs to organization
    if (delivery.endpoint.organizationId !== organization.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Initialize webhook service
    const webhookService = new WebhookService();

    // Retry the delivery
    await webhookService.retryDelivery(delivery.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error retrying webhook delivery:', error);
    return NextResponse.json(
      { error: 'Failed to retry webhook delivery' },
      { status: 500 }
    );
  }
}