import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for feature validation
const planFeatureSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check access - for features, we'll allow limited read access even to non-admins
    // This is useful for displaying on the pricing page
    const isAdmin = await hasValidAdminAccess(session);
    
    // For non-admins, only return public features
    const features = await prisma.planFeature.findMany({
      where: isAdmin ? {} : {
        // Additional filters for public access could be added here
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    return NextResponse.json(features);
  } catch (error) {
    console.error('Error fetching plan features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan features' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Validate data
    const validationResult = planFeatureSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    // Create the feature
    const feature = await prisma.planFeature.create({
      data: validationResult.data
    });
    
    return NextResponse.json(feature, { status: 201 });
  } catch (error) {
    console.error('Error creating plan feature:', error);
    return NextResponse.json(
      { error: 'Failed to create plan feature' },
      { status: 500 }
    );
  }
} 