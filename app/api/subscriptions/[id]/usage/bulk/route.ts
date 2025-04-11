import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { recordUsage } from '@/lib/services/usage-service';
import { z } from 'zod';

// Schema validation for bulk recording usage
const bulkUsageSchema = z.object({
  records: z.array(
    z.object({
      featureId: z.string(),
      quantity: z.number().positive(),
      timestamp: z.string().datetime().optional(),
      metadata: z.record(z.any()).optional(),
    })
  ).min(1).max(100), // Limit to 100 records per request
});

// POST endpoint to record bulk usage
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to manage subscriptions
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'manage:subscriptions'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const subscriptionId = params.id;
    
    // Validate request body
    const body = await request.json();
    const validationResult = bulkUsageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { records } = validationResult.data;
    
    // Check if the subscription exists and user has access
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Check if all features exist
    const featureIds = [...new Set(records.map(record => record.featureId))];
    const existingFeatures = await prisma.feature.findMany({
      where: {
        id: {
          in: featureIds
        }
      },
      select: {
        id: true
      }
    });
    
    const existingFeatureIds = existingFeatures.map(f => f.id);
    const missingFeatureIds = featureIds.filter(id => !existingFeatureIds.includes(id));
    
    if (missingFeatureIds.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some features not found', 
          details: { missingFeatureIds } 
        }, 
        { status: 404 }
      );
    }
    
    // Record all usage in parallel
    const results = await Promise.allSettled(
      records.map(record => 
        recordUsage({
          subscriptionId,
          featureId: record.featureId,
          quantity: record.quantity,
          timestamp: record.timestamp ? new Date(record.timestamp) : undefined,
          metadata: record.metadata,
        })
      )
    );
    
    // Process results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');
    
    const errors = failed.map(r => {
      if (r.status === 'rejected') {
        return r.reason.message || 'Unknown error';
      }
      return null;
    }).filter(Boolean);
    
    return NextResponse.json({
      totalProcessed: results.length,
      successful,
      failed: failed.length,
      errors: errors.length > 0 ? errors : undefined
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording bulk usage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record bulk usage' },
      { status: 500 }
    );
  }
} 