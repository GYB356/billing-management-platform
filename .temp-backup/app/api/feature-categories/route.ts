import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for creating/updating feature categories
const categorySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
});

// GET endpoint to list feature categories
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeFeatures = searchParams.get('includeFeatures') === 'true';
    
    // Get categories
    const [categories, total] = await Promise.all([
      prisma.featureCategory.findMany({
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: includeFeatures ? {
          features: {
            orderBy: [
              { sortOrder: 'asc' },
              { name: 'asc' },
            ],
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
              type: true,
              unit: true,
              isPublic: true,
              sortOrder: true
            }
          }
        } : undefined
      }),
      prisma.featureCategory.count(),
    ]);
    
    return NextResponse.json({
      data: categories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error retrieving feature categories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve feature categories' },
      { status: 500 }
    );
  }
}

// POST endpoint to create a feature category
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
    const validationResult = categorySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const categoryData = validationResult.data;
    
    // Check if category with this code already exists
    const existingCategory = await prisma.featureCategory.findFirst({
      where: {
        code: categoryData.code,
      },
    });
    
    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this code already exists' },
        { status: 409 }
      );
    }
    
    // Create the category
    const category = await prisma.featureCategory.create({
      data: {
        name: categoryData.name,
        code: categoryData.code,
        description: categoryData.description || '',
        sortOrder: categoryData.sortOrder || 0,
      },
    });
    
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error('Error creating feature category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create feature category' },
      { status: 500 }
    );
  }
} 