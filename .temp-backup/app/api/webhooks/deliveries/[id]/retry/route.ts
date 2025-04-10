import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WebhookService } from '@/lib/webhook-service';

// Check permission to access webhook delivery
async function checkDeliveryPermission(deliveryId: string, userId: string, isAdmin: boolean) {
  // Get webhook delivery
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhookEndpoint: {
        select: {
          organizationId: true,
        },
      },
    },
  });
  
  if (!delivery) {
    return { delivery: null, hasPermission: false };
  }
  
  // Admin has access to all webhook deliveries
  if (isAdmin) {
    return { delivery, hasPermission: true };
  }
  
  // Check organization access
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId,
      organizationId: delivery.webhookEndpoint.organizationId,
      role: {
        in: ['OWNER', 'ADMIN'], // Only owner and admin can retry webhook deliveries
      },
    },
  });
  
  return { delivery, hasPermission: !!userOrg };
}

// POST - Retry a failed webhook delivery
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the webhook delivery and check permissions
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: params.id },
      include: { webhookEndpoint: true }
    });

    if (!delivery) {
      return new NextResponse('Webhook delivery not found', { status: 404 });
    }

    // Check if user has access to the organization that owns the webhook
    if (session.user.role !== 'ADMIN') {
      const userOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId: delivery.webhookEndpoint.organizationId,
          role: {
            in: ['OWNER', 'ADMIN'], // Only owners and admins can retry webhooks
          },
        },
      });

      if (!userOrg) {
        return new NextResponse('Access denied', { status: 403 });
      }
    }

    // Retry the webhook delivery
    const success = await WebhookService.retryWebhookDelivery(params.id);

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error retrying webhook delivery:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Cannot retry successful webhook delivery') {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      if (error.message === 'Cannot retry delivery to an inactive webhook endpoint') {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to retry webhook delivery' },
      { status: 500 }
    );
  }
}