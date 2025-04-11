import { NextRequest, NextResponse } from "next/server";
import { getTaxRates, createOrUpdateTaxRate } from "@/lib/tax";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { z } from "zod";

// Validation schema for creating/updating a tax rate
const taxRateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  percentage: z.number().min(0, "Percentage must be >= 0").max(100, "Percentage must be <= 100"),
  country: z.string().min(2, "Country code is required"),
  state: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// GET handler to list tax rates
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const active = url.searchParams.get("active") === "true" ? true : 
                  url.searchParams.get("active") === "false" ? false : 
                  undefined;
    const country = url.searchParams.get("country") || undefined;
    
    // Fetch tax rates
    const taxRates = await getTaxRates({ active, country });

    return NextResponse.json(taxRates);
  } catch (error: any) {
    console.error("Error fetching tax rates:", error);
    
    await createEvent({
      eventType: "TAX_RATE_LIST_ERROR",
      resourceType: "TAX_RATE",
      resourceId: "all",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to fetch tax rates" },
      { status: 500 }
    );
  }
}

// POST handler to create/update a tax rate
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    
    // Validate
    const validatedData = taxRateSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Create/update tax rate
    const taxRate = await createOrUpdateTaxRate(validatedData.data);
    
    return NextResponse.json(taxRate, { status: 201 });
  } catch (error: any) {
    console.error("Error managing tax rate:", error);
    
    await createEvent({
      eventType: "TAX_RATE_MANAGE_ERROR",
      resourceType: "TAX_RATE",
      resourceId: "manage",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to manage tax rate", message: error.message },
      { status: 500 }
    );
  }
} 