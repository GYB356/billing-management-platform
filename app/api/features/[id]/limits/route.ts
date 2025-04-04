import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for feature limits
const limitsSchema = z.object({
  planId: z.string(),
  maxValue: z.number().positive(),
  action: z.enum(['NOTIFY', 'BLOCK', 'UPGRADE']).optional(),
  notificationThresholds: z.array(z.number().min(1).max(100)).optional(), // Percentages
});

// GET endpoint to retrieve limits for a feature across plans
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view billing
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:billing'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const featureId = params.id;
    
    // Verify that the feature exists
    const feature = await prisma.feature.findUnique({
      where: { id: featureId }
    });
    
    if (!feature) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    
    // Build where clause
    const where: any = { featureId };
    
    if (planId) {
      where.planId = planId;
    }
    
    // Retrieve the feature limits from plan-feature associations
    const planFeatures = await prisma.planFeatureAssociation.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });
    
    // Format and return the limits
    const limitsData = planFeatures.map(pf => {
      const limits = typeof pf.limits === 'string' 
        ? JSON.parse(pf.limits) 
        : pf.limits || {};
        
      return {
        planId: pf.planId,
        planName: pf.plan.name,
        featureId,
        limits: {
          maxValue: limits.maxValue || null,
          action: limits.action || null,
          notificationThresholds: limits.notificationThresholds || []
        }
      };
    });
    
    return NextResponse.json({
      data: limitsData,
      meta: {
        total: limitsData.length
      }
    });
  } catch (error: any) {
    console.error('Error retrieving feature limits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve feature limits' },
      { status: 500 }
    );
  }
}

// POST endpoint to set/update limits for a feature in a plan
export async function POST(
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
    
    // Verify that the feature exists
    const feature = await prisma.feature.findUnique({
      where: { id: featureId }
    });
    
    if (!feature) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }
    
    // Validate request body
    const body = await request.json();
    const validationResult = limitsSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { planId, maxValue, action, notificationThresholds } = validationResult.data;
    
    // Verify that the plan exists
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId }
    });
    
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }
    
    // Find or create the plan-feature association
    const planFeature = await prisma.planFeatureAssociation.findFirst({
      where: {
        planId,
        featureId
      }
    });
    
    const limitsData = {
      maxValue,
      action: action || 'NOTIFY',
      notificationThresholds: notificationThresholds || [80, 90, 100]
    };
    
    let updatedPlanFeature;
    
    if (planFeature) {
      // Update existing association
      updatedPlanFeature = await prisma.planFeatureAssociation.update({
        where: {
          id: planFeature.id
        },
        data: {
          limits: limitsData
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true
            }
          },
          feature: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
    } else {
      // Create new association with limits
      updatedPlanFeature = await prisma.planFeatureAssociation.create({
        data: {
          planId,
          featureId,
          limits: limitsData
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true
            }
          },
          feature: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
    }
    
    return NextResponse.json({
      planId: updatedPlanFeature.planId,
      planName: updatedPlanFeature.plan.name,
      featureId: updatedPlanFeature.featureId,
      featureName: updatedPlanFeature.feature.name,
      featureCode: updatedPlanFeature.feature.code,
      limits: limitsData
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error setting feature limits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set feature limits' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove limits for a feature in a plan
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    
    if (!planId) {
      return NextResponse.json(
        { error: 'planId query parameter is required' },
        { status: 400 }
      );
    }
    
    // Find the plan-feature association
    const planFeature = await prisma.planFeatureAssociation.findFirst({
      where: {
        planId,
        featureId
      }
    });
    
    if (!planFeature) {
      return NextResponse.json(
        { error: 'Feature limit not found for the specified plan' },
        { status: 404 }
      );
    }
    
    // Update the association to remove limits
    await prisma.planFeatureAssociation.update({
      where: {
        id: planFeature.id
      },
      data: {
        limits: null
      }
    });
    
    return NextResponse.json({
      message: 'Feature limits removed successfully',
      planId,
      featureId
    });
  } catch (error: any) {
    console.error('Error removing feature limits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove feature limits' },
      { status: 500 }
    );
  }
} 