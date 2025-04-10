import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const OrganizationSettingsSchema = z.object({
  defaultCurrency: z.string().optional(),
  defaultLanguage: z.string().optional(),
  defaultTaxBehavior: z.enum(['inclusive', 'exclusive', 'automatic']).optional(),
  priceDisplaySettings: z.object({
    showCurrencyCode: z.boolean().optional(),
    currencyPosition: z.enum(['before', 'after']).optional(),
    showThousandsSeparator: z.boolean().optional(),
    thousandsSeparator: z.string().optional(),
    decimalSeparator: z.string().optional(),
  }).optional(),
  taxSettings: z.object({
    defaultTaxRate: z.number().optional(),
    applyReverseCharge: z.boolean().optional(),
    enableAutomaticTaxCalculation: z.boolean().optional(),
    defaultTaxJurisdiction: z.string().optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const settings = OrganizationSettingsSchema.parse(body);

    const updatedSettings = await prisma.organizationSettings.upsert({
      where: { organizationId: session.user.organizationId },
      update: settings,
      create: {
        ...settings,
        organizationId: session.user.organizationId,
      },
    });

    // Create event for settings update
    await prisma.event.create({
      data: {
        eventType: 'ORGANIZATION_SETTINGS_UPDATED',
        resourceType: 'ORGANIZATION_SETTINGS',
        resourceId: updatedSettings.id,
        organizationId: session.user.organizationId,
        userId: session.user.id,
        metadata: {
          changes: settings,
        },
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return NextResponse.json(
      { error: 'Failed to update organization settings' },
      { status: 400 }
    );
  }
}