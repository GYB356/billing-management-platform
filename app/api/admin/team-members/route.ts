import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityMonitoring } from '@/lib/security-monitoring';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view team members
    const hasAccess = await securityMonitoring.checkPermission(
      session.user.id,
      'view:organizations'
    );
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const members = await prisma.userOrganization.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            permissions: {
              select: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Transform the data to match the expected format
    const transformedMembers = members.map(member => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.user.role,
      organizationRole: member.role,
      permissions: member.user.permissions.map(p => p.permission),
    }));

    return NextResponse.json(transformedMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}