import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for org role update request
const updateOrgRoleSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

// Get user's organization role
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const searchParams = new URL(request.url).searchParams;
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    
    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'User ID and Organization ID are required' },
        { status: 400 }
      );
    }
    
    // Check if the requester has permission to view organization users
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:organizations'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Additional check: verify the user is part of the requested organization
    // if they're not a system admin
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      const userOrgMembership = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
        },
      });
      
      if (!userOrgMembership) {
        return NextResponse.json(
          { error: 'You do not have access to this organization' },
          { status: 403 }
        );
      }
    }
    
    const userOrgRole = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
      },
      select: {
        userId: true,
        organizationId: true,
        role: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!userOrgRole) {
      return NextResponse.json(
        { error: 'User is not a member of the specified organization' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(userOrgRole);
  } catch (error) {
    console.error('Error getting organization role:', error);
    return NextResponse.json(
      { error: 'Failed to get organization role' },
      { status: 500 }
    );
  }
}

// Update user's organization role
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the requester has permission to manage organizations
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:organizations'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const body = await request.json();
    
    // Validate request body
    const validationResult = updateOrgRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { userId, organizationId, role } = validationResult.data;
    
    // For regular users (not system admins), check if they're owners of the org
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      const userOrgRole = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
          role: 'OWNER',
        },
      });
      
      if (!userOrgRole) {
        return NextResponse.json(
          { error: 'Only organization owners can modify member roles' },
          { status: 403 }
        );
      }
    }
    
    // Prevent changing the only owner
    if (role !== 'OWNER') {
      const ownersCount = await prisma.userOrganization.count({
        where: {
          organizationId,
          role: 'OWNER',
        },
      });
      
      const currentRole = await prisma.userOrganization.findFirst({
        where: {
          userId,
          organizationId,
        },
        select: { role: true },
      });
      
      if (ownersCount === 1 && currentRole?.role === 'OWNER') {
        return NextResponse.json(
          { error: 'Cannot demote the only owner of the organization' },
          { status: 400 }
        );
      }
    }
    
    // Update user's organization role
    const updatedOrgRole = await prisma.userOrganization.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data: { role },
      select: {
        userId: true,
        organizationId: true,
        role: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
    
    return NextResponse.json(updatedOrgRole);
  } catch (error) {
    console.error('Error updating organization role:', error);
    return NextResponse.json(
      { error: 'Failed to update organization role' },
      { status: 500 }
    );
  }
} 