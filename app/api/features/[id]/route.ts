import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for updating features
const updateFeatureSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  sortOrder: z.number().optional(),
});

// GET endpoint to retrieve a specific feature
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const featureId = params.id;
    
    // Find the feature
    const feature = await prisma.feature.findUnique({
      where: { id: featureId },
    });
    
    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    
    // Check if the feature is public or user has permission
    if (!feature.isPublic) {
      try {
        requirePermission(
          session.user.role as any,
          session.user.organizationRole as any || 'MEMBER',
          'manage:billing'
        );
      } catch (error) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    
    return NextResponse.json(feature);
  } catch (error: any) {
    console.error('Error retrieving feature:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve feature' },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update a feature
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage billing
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:billing'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const featureId = params.id;
    
    // Check if feature exists
    const existingFeature = await prisma.feature.findUnique({
      where: { id: featureId },
    });
    
    if (!existingFeature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    
    // Validate request body
    const body = await request.json();
    const validationResult = updateFeatureSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    // Update the feature
    const updatedFeature = await prisma.feature.update({
      where: { id: featureId },
      data: validationResult.data,
    });
    
    return NextResponse.json(updatedFeature);
  } catch (error: any) {
    console.error('Error updating feature:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update feature' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a feature
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage billing
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:billing'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const featureId = params.id;
    
    // Check if feature exists
    const existingFeature = await prisma.feature.findUnique({
      where: { id: featureId },
    });
    
    if (!existingFeature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    
    // Check if feature is used in any plans or subscriptions
    const featureUsage = await prisma.planFeature.findFirst({
      where: { featureId },
    });
    
    if (featureUsage) {
      return NextResponse.json(
        { error: 'Cannot delete feature as it is associated with one or more plans' },
        { status: 409 }
      );
    }
    
    // Delete the feature
    await prisma.feature.delete({
      where: { id: featureId },
    });
    
    return NextResponse.json(
      { message: 'Feature deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting feature:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete feature' },
      { status: 500 }
    );
  }
}
