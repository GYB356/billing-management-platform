import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for creating/updating features
const featureSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['BOOLEAN', 'NUMERIC', 'METERED']),
  unit: z.string().optional(),
  isPublic: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
  sortOrder: z.number().optional(),
});

// GET endpoint to list features
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'BOOLEAN' | 'NUMERIC' | 'METERED' | null;
    const isPublic = searchParams.get('isPublic') === 'true' ? true : 
                    searchParams.get('isPublic') === 'false' ? false : 
                    undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Anyone can view public features, but for all features need admin permission
    const viewingAllFeatures = isPublic === undefined || isPublic === false;
    
    if (viewingAllFeatures) {
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
    
    // Build where clause
    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }
    
    // Get features
    const [features, total] = await Promise.all([
      prisma.feature.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feature.count({ where }),
    ]);
    
    return NextResponse.json({
      data: features,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error retrieving features:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve features' },
      { status: 500 }
    );
  }
}

// POST endpoint to create a feature
export async function POST(request: Request) {
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
    
    // Validate request body
    const body = await request.json();
    const validationResult = featureSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const featureData = validationResult.data;
    
    // Check if feature with this code already exists
    const existingFeature = await prisma.feature.findFirst({
      where: {
        code: featureData.code,
      },
    });
    
    if (existingFeature) {
      return NextResponse.json(
        { error: 'A feature with this code already exists' },
        { status: 409 }
      );
    }
    
    // Create the feature
    const feature = await prisma.feature.create({
      data: {
        name: featureData.name,
        code: featureData.code,
        description: featureData.description || '',
        type: featureData.type,
        unit: featureData.unit,
        isPublic: featureData.isPublic,
        metadata: featureData.metadata || {},
        sortOrder: featureData.sortOrder || 0,
      },
    });
    
    return NextResponse.json(feature, { status: 201 });
  } catch (error: any) {
    console.error('Error creating feature:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create feature' },
      { status: 500 }
    );
  }
}