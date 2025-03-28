import { NextRequest, NextResponse } from "next/server";
import { createOneTimePayment, getOrganizationOneTimePayments } from "@/lib/payments";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for creating a payment
const createPaymentSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  paymentMethod: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET handler to list payments
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organizationId");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const status = url.searchParams.get("status") as any;

    // Ensure organizationId is provided
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Check if user has access to this organization
    if (session.user.role !== "ADMIN") {
      // Regular users should only see their organizations
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

    // Get payments
    const result = await getOrganizationOneTimePayments(organizationId, {
      limit,
      offset,
      status,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    
    await createEvent({
      eventType: "PAYMENT_LIST_ERROR",
      resourceType: "PAYMENT",
      resourceId: "all",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// POST handler to create a payment
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
    const validatedData = createPaymentSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    const { organizationId } = validatedData.data;
    
    // Check if user has access to this organization
    if (session.user.role !== "ADMIN") {
      // Regular users should only create payments for their organizations
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
    
    // Create payment
    const payment = await createOneTimePayment(validatedData.data);
    
    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error("Error creating payment:", error);
    
    await createEvent({
      eventType: "PAYMENT_CREATE_ERROR",
      resourceType: "PAYMENT",
      resourceId: "new",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to create payment", message: error.message },
      { status: 500 }
    );
  }
} 