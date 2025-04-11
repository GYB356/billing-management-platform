import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { IntegrationService } from '@/lib/services/integration-service';
import { z } from 'zod';

const connectSchema = z.object({
  type: z.string()
});

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
    const validatedData = connectSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Initialize integration service
    const integrationService = new IntegrationService();

    // Generate OAuth URL
    const authUrl = integrationService.getAuthorizationUrl(
      validatedData.data.type as any,
      organization.id
    );

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error initiating integration:', error);
    return NextResponse.json(
      { error: 'Failed to initiate integration' },
      { status: 500 }
    );
  }
}