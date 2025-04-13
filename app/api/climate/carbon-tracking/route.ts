import { NextResponse } from 'next/server';
import Patch from '@patch-technology/patch';
import { prisma } from '@/lib/prisma';

const patch = new Patch(process.env.PATCH_API_KEY!);

export async function POST(req: Request) {
  try {
    const { transactionId, usageData, customerId } = await req.json();

    if (!transactionId || !usageData || !customerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate carbon impact based on usage
    const estimates = await calculateCarbonImpact(usageData);

    // Create Patch.io estimate
    const patchEstimate = await patch.estimates.create({
      type: 'transaction',
      transaction_value: estimates.totalEmissions,
      transaction_value_unit: 'kg',
      description: `Carbon footprint for transaction ${transactionId}`
    });

    // Store carbon estimate in database
    const carbonEstimate = await prisma.carbonEstimate.create({
      data: {
        transactionId,
        customerId,
        totalEmissions: estimates.totalEmissions,
        breakdown: estimates.breakdown,
        patchEstimateId: patchEstimate.id,
        status: 'estimated',
        offsetStatus: 'pending',
        metadata: {
          patch_response: patchEstimate,
          usage_data: usageData
        }
      }
    });

    return NextResponse.json({
      estimate: {
        id: carbonEstimate.id,
        totalEmissions: estimates.totalEmissions,
        breakdown: estimates.breakdown,
        offsetCost: patchEstimate.price_cents / 100, // Convert to dollars
        offsetOptions: await getOffsetOptions(estimates.totalEmissions)
      }
    });
  } catch (error) {
    console.error('Error tracking carbon impact:', error);
    return NextResponse.json(
      { error: 'Failed to calculate carbon impact' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { estimateId, offsetOption } = await req.json();

    if (!estimateId || !offsetOption) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const estimate = await prisma.carbonEstimate.findUnique({
      where: { id: estimateId }
    });

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    // Create Patch.io order for carbon offset
    const order = await patch.orders.create({
      estimate_id: estimate.patchEstimateId,
      project_id: offsetOption.projectId,
      total_price_cents: offsetOption.priceCents
    });

    // Update carbon estimate with offset information
    const updatedEstimate = await prisma.carbonEstimate.update({
      where: { id: estimateId },
      data: {
        offsetStatus: 'completed',
        offsetDetails: {
          orderId: order.id,
          projectId: offsetOption.projectId,
          amount: order.total_price_cents / 100,
          timestamp: new Date()
        }
      }
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.total_price_cents / 100,
        project: offsetOption.projectName
      }
    });
  } catch (error) {
    console.error('Error offsetting carbon:', error);
    return NextResponse.json(
      { error: 'Failed to process carbon offset' },
      { status: 500 }
    );
  }
}

// Helper function to calculate carbon impact from usage data
async function calculateCarbonImpact(usageData: any) {
  const breakdown = [];
  let totalEmissions = 0;

  // Calculate emissions for compute resources
  if (usageData.compute) {
    const computeEmissions = usageData.compute * 0.000283; // kgCO2/CPU-hour
    breakdown.push({
      category: 'Compute',
      emissions: computeEmissions,
      unit: 'kgCO2e'
    });
    totalEmissions += computeEmissions;
  }

  // Calculate emissions for storage
  if (usageData.storage) {
    const storageEmissions = usageData.storage * 0.000007; // kgCO2/GB-month
    breakdown.push({
      category: 'Storage',
      emissions: storageEmissions,
      unit: 'kgCO2e'
    });
    totalEmissions += storageEmissions;
  }

  // Calculate emissions for network transfer
  if (usageData.network) {
    const networkEmissions = usageData.network * 0.000011; // kgCO2/GB
    breakdown.push({
      category: 'Network',
      emissions: networkEmissions,
      unit: 'kgCO2e'
    });
    totalEmissions += networkEmissions;
  }

  return {
    totalEmissions,
    breakdown
  };
}

// Helper function to get available offset options from Patch.io
async function getOffsetOptions(emissions: number) {
  const projects = await patch.projects.list({
    type: 'removal',
    country: 'US',
    minimum_available_mass_g: emissions * 1000 // Convert kg to g
  });

  return projects.data.map(project => ({
    projectId: project.id,
    projectName: project.name,
    description: project.description,
    type: project.type,
    priceCents: Math.ceil(emissions * project.price_per_tonne_cents / 1000), // Convert to kg pricing
    location: project.country,
    cobenefits: project.cobenefits
  }));
} 