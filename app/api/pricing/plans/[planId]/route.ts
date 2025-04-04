import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for plan validation
const pricingPlanUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  pricingType: z.enum(['flat', 'per_user', 'tiered', 'usage_based']).optional(),
  basePrice: z.number().min(0, 'Price must be 0 or greater').optional(),
  currency: z.enum(['USD', 'EUR', 'GBP']).optional(),
  billingInterval: z.enum(['monthly', 'quarterly', 'annual', 'custom']).optional(),
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

export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access for detailed plan view
    if (!(await hasValidAdminAccess(session))) {
      // For public plans, allow limited access
      const plan = await prisma.pricingPlan.findUnique({
        where: { 
          id: params.planId,
          isPublic: true,
          isActive: true
        },
        include: {
          tiers: true,
          planFeatures: {
            include: {
              feature: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isHighlighted: true
                }
              }
            }
          }
        }
      });
      
      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      
      return NextResponse.json(plan);
    }
    
    // Full access for admins
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: params.planId },
      include: {
        tiers: true,
        planFeatures: {
          include: {
            feature: true
          }
        }
      }
    });
    
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    
    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error fetching pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing plan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Validate data
    const validationResult = pricingPlanUpdateSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { selectedFeatures, tiers, ...planData } = validationResult.data;
    
    // Check if plan exists
    const existingPlan = await prisma.pricingPlan.findUnique({
      where: { id: params.planId },
      include: {
        tiers: true,
        planFeatures: true
      }
    });
    
    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    
    // Update the plan in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the base plan
      const updatedPlan = await tx.pricingPlan.update({
        where: { id: params.planId },
        data: planData,
        include: {
          tiers: true
        }
      });
      
      // Handle tiers if pricing type is tiered
      if (planData.pricingType === 'tiered' || existingPlan.pricingType === 'tiered') {
        // Delete existing tiers if new ones are provided or pricing type changed
        if (
          tiers || 
          (planData.pricingType && planData.pricingType !== 'tiered' && existingPlan.pricingType === 'tiered')
        ) {
          await tx.pricingTier.deleteMany({
            where: { planId: params.planId }
          });
        }
        
        // Create new tiers if provided and appropriate for the pricing type
        if (tiers && (planData.pricingType === 'tiered' || existingPlan.pricingType === 'tiered')) {
          await Promise.all(
            tiers.map(tier =>
              tx.pricingTier.create({
                data: {
                  planId: params.planId,
                  upTo: tier.infinite ? null : tier.upTo,
                  price: tier.price,
                  flatFee: tier.flatFee,
                  perUnitFee: tier.perUnitFee,
                  infinite: tier.infinite || false
                }
              })
            )
          );
        }
      }
      
      // Handle feature associations if provided
      if (selectedFeatures) {
        // Delete existing feature associations
        await tx.planFeature.deleteMany({
          where: { planId: params.planId }
        });
        
        // Create new feature associations
        if (selectedFeatures.length > 0) {
          await Promise.all(
            selectedFeatures.map(featureId =>
              tx.planFeature.create({
                data: {
                  planId: params.planId,
                  featureId
                }
              })
            )
          );
        }
      }
      
      // Get the updated plan with fresh relations
      return tx.pricingPlan.findUnique({
        where: { id: params.planId },
        include: {
          tiers: true,
          planFeatures: {
            include: {
              feature: true
            }
          }
        }
      });
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Check if the plan is associated with any active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        pricingPlanId: params.planId,
        status: {
          in: ['active', 'trialing']
        }
      }
    });
    
    if (activeSubscriptions > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete plan with active subscriptions',
          activeSubscriptions
        }, 
        { status: 400 }
      );
    }
    
    // Delete the plan and its related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related plan features
      await tx.planFeature.deleteMany({
        where: { planId: params.planId }
      });
      
      // Delete related pricing tiers
      await tx.pricingTier.deleteMany({
        where: { planId: params.planId }
      });
      
      // Finally delete the plan itself
      await tx.pricingPlan.delete({
        where: { id: params.planId }
      });
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete pricing plan' },
      { status: 500 }
    );
  }
} 
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for plan validation
const pricingPlanUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  pricingType: z.enum(['flat', 'per_user', 'tiered', 'usage_based']).optional(),
  basePrice: z.number().min(0, 'Price must be 0 or greater').optional(),
  currency: z.enum(['USD', 'EUR', 'GBP']).optional(),
  billingInterval: z.enum(['monthly', 'quarterly', 'annual', 'custom']).optional(),
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

export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access for detailed plan view
    if (!(await hasValidAdminAccess(session))) {
      // For public plans, allow limited access
      const plan = await prisma.pricingPlan.findUnique({
        where: { 
          id: params.planId,
          isPublic: true,
          isActive: true
        },
        include: {
          tiers: true,
          planFeatures: {
            include: {
              feature: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isHighlighted: true
                }
              }
            }
          }
        }
      });
      
      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      
      return NextResponse.json(plan);
    }
    
    // Full access for admins
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: params.planId },
      include: {
        tiers: true,
        planFeatures: {
          include: {
            feature: true
          }
        }
      }
    });
    
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    
    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error fetching pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing plan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Validate data
    const validationResult = pricingPlanUpdateSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { selectedFeatures, tiers, ...planData } = validationResult.data;
    
    // Check if plan exists
    const existingPlan = await prisma.pricingPlan.findUnique({
      where: { id: params.planId },
      include: {
        tiers: true,
        planFeatures: true
      }
    });
    
    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    
    // Update the plan in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the base plan
      const updatedPlan = await tx.pricingPlan.update({
        where: { id: params.planId },
        data: planData,
        include: {
          tiers: true
        }
      });
      
      // Handle tiers if pricing type is tiered
      if (planData.pricingType === 'tiered' || existingPlan.pricingType === 'tiered') {
        // Delete existing tiers if new ones are provided or pricing type changed
        if (
          tiers || 
          (planData.pricingType && planData.pricingType !== 'tiered' && existingPlan.pricingType === 'tiered')
        ) {
          await tx.pricingTier.deleteMany({
            where: { planId: params.planId }
          });
        }
        
        // Create new tiers if provided and appropriate for the pricing type
        if (tiers && (planData.pricingType === 'tiered' || existingPlan.pricingType === 'tiered')) {
          await Promise.all(
            tiers.map(tier =>
              tx.pricingTier.create({
                data: {
                  planId: params.planId,
                  upTo: tier.infinite ? null : tier.upTo,
                  price: tier.price,
                  flatFee: tier.flatFee,
                  perUnitFee: tier.perUnitFee,
                  infinite: tier.infinite || false
                }
              })
            )
          );
        }
      }
      
      // Handle feature associations if provided
      if (selectedFeatures) {
        // Delete existing feature associations
        await tx.planFeature.deleteMany({
          where: { planId: params.planId }
        });
        
        // Create new feature associations
        if (selectedFeatures.length > 0) {
          await Promise.all(
            selectedFeatures.map(featureId =>
              tx.planFeature.create({
                data: {
                  planId: params.planId,
                  featureId
                }
              })
            )
          );
        }
      }
      
      // Get the updated plan with fresh relations
      return tx.pricingPlan.findUnique({
        where: { id: params.planId },
        include: {
          tiers: true,
          planFeatures: {
            include: {
              feature: true
            }
          }
        }
      });
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check admin access
    if (!(await hasValidAdminAccess(session))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Check if the plan is associated with any active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        pricingPlanId: params.planId,
        status: {
          in: ['active', 'trialing']
        }
      }
    });
    
    if (activeSubscriptions > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete plan with active subscriptions',
          activeSubscriptions
        }, 
        { status: 400 }
      );
    }
    
    // Delete the plan and its related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related plan features
      await tx.planFeature.deleteMany({
        where: { planId: params.planId }
      });
      
      // Delete related pricing tiers
      await tx.pricingTier.deleteMany({
        where: { planId: params.planId }
      });
      
      // Finally delete the plan itself
      await tx.pricingPlan.delete({
        where: { id: params.planId }
      });
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pricing plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete pricing plan' },
      { status: 500 }
    );
  }
}