import { NextRequest, NextResponse } from "next/server";
import { getOrganizationTaxSettings, updateOrganizationTaxSettings } from "@/lib/tax";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for updating tax settings
const updateTaxSettingsSchema = z.object({
  taxExempt: z.boolean().optional(),
  taxId: z.string().optional(),
  taxCountry: z.string().optional(),
  taxState: z.string().optional(),
});

// GET handler to get tax settings
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organizationId = params.id;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to this organization
    if (session.user.role !== "ADMIN") {
      const userOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
        },
      });

      if (!userOrg) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    
    // Get tax settings
    const taxSettings = await getOrganizationTaxSettings(organizationId);

    return NextResponse.json(taxSettings);
  } catch (error: any) {
    console.error("Error fetching tax settings:", error);
    
    await createEvent({
      eventType: "TAX_SETTINGS_FETCH_ERROR",
      resourceType: "ORGANIZATION",
      resourceId: params.id,
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to fetch tax settings" },
      { status: 500 }
    );
  }
}

// PATCH handler to update tax settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organizationId = params.id;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to this organization
    if (session.user.role !== "ADMIN") {
      const userOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!userOrg) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    
    // Parse request body
    const body = await req.json();
    
    // Validate
    const validatedData = updateTaxSettingsSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Update tax settings
    await updateOrganizationTaxSettings(organizationId, validatedData.data);
    
    // Get updated settings
    const updatedSettings = await getOrganizationTaxSettings(organizationId);
    
    return NextResponse.json(updatedSettings);
  } catch (error: any) {
    console.error("Error updating tax settings:", error);
    
    await createEvent({
      eventType: "TAX_SETTINGS_UPDATE_ERROR",
      resourceType: "ORGANIZATION",
      resourceId: params.id,
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to update tax settings", message: error.message },
      { status: 500 }
    );
  }
} 