import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { z } from 'zod';

// Schema validation for updating categories
const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
});

// GET endpoint to retrieve a specific category
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const categoryId = params.id;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeFeatures = searchParams.get('includeFeatures') === 'true';
    
    // Find the category
    const category = await prisma.featureCategory.findUnique({
      where: { id: categoryId },
      include: includeFeatures ? {
        features: {
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        }
      } : undefined
    });
    
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    return NextResponse.json(category);
  } catch (error: any) {
    console.error('Error retrieving category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve category' },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update a category
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
    
    const categoryId = params.id;
    
    // Check if category exists
    const existingCategory = await prisma.featureCategory.findUnique({
      where: { id: categoryId },
    });
    
    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    // Validate request body
    const body = await request.json();
    const validationResult = updateCategorySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    // Update the category
    const updatedCategory = await prisma.featureCategory.update({
      where: { id: categoryId },
      data: validationResult.data,
    });
    
    return NextResponse.json(updatedCategory);
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a category
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
    
    const categoryId = params.id;
    
    // Check if category exists
    const existingCategory = await prisma.featureCategory.findUnique({
      where: { id: categoryId },
      include: {
        features: {
          take: 1
        }
      }
    });
    
    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    // Check if category has any features
    if (existingCategory.features.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category as it has features associated with it. Please move or delete the features first.' },
        { status: 409 }
      );
    }
    
    // Delete the category
    await prisma.featureCategory.delete({
      where: { id: categoryId },
    });
    
    return NextResponse.json(
      { message: 'Category deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
} 