import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityMonitoring } from '@/lib/security-monitoring';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdatePermissionsSchema = z.object({
  userId: z.string(),
  permissions: z.array(z.string()),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage team permissions
    const hasAccess = await securityMonitoring.checkPermission(
      session.user.id,
      'manage:organizations'
    );
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = UpdatePermissionsSchema.parse(body);

    // Update user permissions
    await prisma.userPermission.deleteMany({
      where: { userId: validatedData.userId },
    });

    await prisma.userPermission.createMany({
      data: validatedData.permissions.map(permission => ({
        userId: validatedData.userId,
        permission,
      })),
    });

    // Log the permission update activity
    await securityMonitoring.logActivityEvent({
      userId: session.user.id,
      action: 'UPDATE_PERMISSIONS',
      resource: 'user_permissions',
      details: {
        targetUserId: validatedData.userId,
        permissions: validatedData.permissions,
      },
      organizationId: session.user.organizationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view team permissions
    const hasAccess = await securityMonitoring.checkPermission(
      session.user.id,
      'view:organizations'
    );
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const permissions = await prisma.userPermission.findMany({
      where: { userId },
      select: { permission: true },
    });

    return NextResponse.json(permissions.map(p => p.permission));
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}