import { NextRequest, NextResponse } from "next/server";
import { createTrialSubscription, extendTrial } from "@/lib/trials";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for creating a trial
const createTrialSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  planId: z.string().min(1, "Plan ID is required"),
  trialDays: z.number().positive().optional(),
});

// Validation schema for extending a trial
const extendTrialSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
  additionalDays: z.number().positive("Additional days must be positive"),
});

// POST handler to create a trial subscription
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    
    // Validate
    const validatedData = createTrialSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    const { organizationId } = validatedData.data;
    
    // Check if user has access to this organization
    if (session.user.role !== "ADMIN") {
      // Regular users should only create trials for their organizations
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
    
    // Create trial subscription
    const subscription = await createTrialSubscription(validatedData.data);
    
    return NextResponse.json(subscription, { status: 201 });
  } catch (error: any) {
    console.error("Error creating trial subscription:", error);
    
    await createEvent({
      eventType: "TRIAL_CREATE_ERROR",
      resourceType: "SUBSCRIPTION",
      resourceId: "new",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to create trial subscription", message: error.message },
      { status: 500 }
    );
  }
}

// PATCH handler to extend a trial
export async function PATCH(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin access only for extending trials
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    
    // Validate
    const validatedData = extendTrialSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Extend the trial
    const subscription = await extendTrial(validatedData.data);
    
    return NextResponse.json(subscription);
  } catch (error: any) {
    console.error("Error extending trial:", error);
    
    await createEvent({
      eventType: "TRIAL_EXTEND_ERROR",
      resourceType: "SUBSCRIPTION",
      resourceId: "extend",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to extend trial", message: error.message },
      { status: 500 }
    );
  }
} 