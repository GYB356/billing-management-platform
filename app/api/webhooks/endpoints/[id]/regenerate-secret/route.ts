import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WebhookService } from '@/lib/webhook-service';

// Check if user has permission to access webhook
async function checkWebhookPermission(webhookId: string, userId: string, isAdmin: boolean) {
  // Get webhook endpoint
  const webhook = await prisma.webhookEndpoint.findUnique({
    where: { id: webhookId },
  });
  
  if (!webhook) {
    return { webhook: null, hasPermission: false };
  }
  
  // Admin has access to all webhooks
  if (isAdmin) {
    return { webhook, hasPermission: true };
  }
  
  // Check organization access
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId,
      organizationId: webhook.organizationId,
      role: {
        in: ['OWNER', 'ADMIN'], // Only owner and admin can manage webhooks
      },
    },
  });
  
  return { webhook, hasPermission: !!userOrg };
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
    const { webhook, hasPermission } = await checkWebhookPermission(
      params.id,
      session.user.id,
      session.user.role === 'ADMIN'
    );
    
    if (!webhook) {
      return new NextResponse('Webhook not found', { status: 404 });
    }
    
    if (!hasPermission) {
      return new NextResponse('Access denied', { status: 403 });
    }
    
    // Regenerate secret key
    const newSecretKey = await WebhookService.regenerateSecretKey(params.id);
    
    // Return new secret key
    return NextResponse.json({
      id: webhook.id,
      secretKey: newSecretKey,
      message: 'Secret key regenerated successfully',
    });
  } catch (error) {
    console.error('Error regenerating webhook secret key:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 