import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { IntegrationService } from '@/lib/services/integration-service';

export async function POST(
  request: Request,
  { params }: { params: { type: string } }
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

    // Initialize integration service
    const integrationService = new IntegrationService();

    // Disconnect integration
    await integrationService.disconnectIntegration(
      organization.id,
      params.type as any
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}