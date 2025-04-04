import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for feature update validation
const planFeatureUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  unitName: z.string().optional().nullable(),
  isHighlighted: z.boolean().optional(),
});

async function hasValidAdminAccess(session: any) {
  if (!session || !session.user) {
    return false;
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true }
  });
  
  return user?.roles.some(role => role.name === 'admin');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { featureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // For individual features, we'll require admin access for detailed view
    if (!(await hasValidAdminAccess(session))) {
      // For public access, return limited feature information
      const feature = await prisma.planFeature.findUnique({
        where: { id: params.featureId },
        select: {
          id: true,
          name: true,
          description: true,
          isHighlighted: true
        }
      });
      
      if (!feature) {
        return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
      }
      
      return NextResponse.json(feature);
    }
    
    // Full access for admins
    const feature = await prisma.planFeature.findUnique({
      where: { id: params.featureId },
      include: {
        planFeatures: {
          include: {
            plan: true
          }
        }
      }
    });
    
    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    
    return NextResponse.json(feature);
  } catch (error) {
    console.error('Error fetching feature:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { featureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Validate data
    const validationResult = planFeatureUpdateSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    // Check if feature exists
    const existingFeature = await prisma.planFeature.findUnique({
      where: { id: params.featureId }
    });
    
    if (!existingFeature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }
    
    // Update the feature
    const updatedFeature = await prisma.planFeature.update({
      where: { id: params.featureId },
      data: validationResult.data
    });
    
    return NextResponse.json(updatedFeature);
  } catch (error) {
    console.error('Error updating feature:', error);
    return NextResponse.json(
      { error: 'Failed to update feature' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { featureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Perform the feature deletion using Prisma
    await prisma.feature.delete({
      where: { id: params.featureId },
    });

    // Return a success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FEATURE_DELETE_ERROR]', error);

    // Return an error response in case of failure
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}