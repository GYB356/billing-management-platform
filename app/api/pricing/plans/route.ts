import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for plan validation
const pricingPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  pricingType: z.enum(['flat', 'per_user', 'tiered', 'usage_based']),
  basePrice: z.number().min(0, 'Price must be 0 or greater'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  billingInterval: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  trialDays: z.number().min(0, 'Trial days must be 0 or greater').optional(),
  sortOrder: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  tiers: z.array(
    z.object({
      id: z.string().optional(),
      upTo: z.number().nullable().optional(),
      price: z.number().nullable().optional(),
      flatFee: z.number().nullable().optional(),
      perUnitFee: z.number().nullable().optional(),
      infinite: z.boolean().optional(),
    })
  ).optional(),
  selectedFeatures: z.array(z.string()).optional(),
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
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const plans = await prisma.pricingPlan.findMany({
      include: {
        tiers: true,
        planFeatures: {
          include: {
            feature: true
          }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });
    
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing plans' },
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
    const validationResult = pricingPlanSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { selectedFeatures, tiers, ...planData } = validationResult.data;
    
    // Create the plan in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the base plan
      const plan = await tx.pricingPlan.create({
        data: {
          ...planData,
          // Include tiers if provided and appropriate for the pricing type
          tiers: planData.pricingType === 'tiered' && tiers 
            ? {
                create: tiers.map(tier => ({
                  upTo: tier.infinite ? null : tier.upTo,
                  price: tier.price,
                  flatFee: tier.flatFee,
                  perUnitFee: tier.perUnitFee,
                  infinite: tier.infinite || false
                }))
              }
            : undefined,
        },
        include: {
          tiers: true
        }
      });
      
      // Associate features if provided
      if (selectedFeatures && selectedFeatures.length > 0) {
        await Promise.all(
          selectedFeatures.map(featureId =>
            tx.planFeature.create({
              data: {
                planId: plan.id,
                featureId
              }
            })
          )
        );
      }
      
      return plan;
    });
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing plan' },
      { status: 500 }
    );
  }
}