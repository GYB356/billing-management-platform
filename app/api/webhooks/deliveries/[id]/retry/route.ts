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

    // Check permissions
    const { delivery, hasPermission } = await checkDeliveryPermission(
      params.id,
      session.user.id,
      session.user.role === 'ADMIN'
    );
    
    if (!delivery) {
      return new NextResponse('Webhook delivery not found', { status: 404 });
    }
    
    if (!hasPermission) {
      return new NextResponse('Access denied', { status: 403 });
    }
    
    // Check if delivery is already successful
    if (delivery.status === 'SUCCESS') {
      return NextResponse.json(
        { error: 'Cannot retry a successful webhook delivery' },
        { status: 400 }
      );
    }
    
    // Retry webhook delivery
    const success = await WebhookService.retryWebhookDelivery(params.id);
    
    // Return result
    return NextResponse.json({
      id: delivery.id,
      success,
      message: success 
        ? 'Webhook delivery retried successfully' 
        : 'Webhook delivery retry failed',
    });
  } catch (error) {
    console.error('Error retrying webhook delivery:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 