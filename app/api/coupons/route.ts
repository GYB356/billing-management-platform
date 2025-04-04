import { NextRequest, NextResponse } from "next/server";
import { createCoupon, validateCouponCode } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { z } from "zod";

// Validation schema for creating a coupon
const createCouponSchema = z.object({
  promotionId: z.string().min(1, "Promotion ID is required"),
  code: z.string().min(3, "Code must be at least 3 characters"),
  maxRedemptions: z.number().optional(),
});

// Validation schema for validating a coupon
const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  planId: z.string().optional(),
});

// GET handler to list coupons
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const promotionId = url.searchParams.get("promotionId");
    const active = url.searchParams.get("active") === "true";
    
    // Build the query
    const whereClause: any = {};
    
    if (promotionId) {
      whereClause.promotionId = promotionId;
    }
    
    if (active !== undefined) {
      whereClause.active = active;
    }
    
    // Fetch coupons
    const coupons = await prisma.coupon.findMany({
      where: whereClause,
      include: {
        promotion: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(coupons);
  } catch (error: any) {
    console.error("Error fetching coupons:", error);
    
    await createEvent({
      eventType: "COUPON_LIST_ERROR",
      resourceType: "COUPON",
      resourceId: "all",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to fetch coupons" },
      { status: 500 }
    );
  }
}

// POST handler to create a coupon
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
    const validatedData = createCouponSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Create coupon
    const coupon = await createCoupon(validatedData.data);
    
    return NextResponse.json(coupon, { status: 201 });
  } catch (error: any) {
    console.error("Error creating coupon:", error);
    
    await createEvent({
      eventType: "COUPON_CREATE_ERROR",
      resourceType: "COUPON",
      resourceId: "new",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to create coupon", message: error.message },
      { status: 500 }
    );
  }
}

// PUT handler to validate a coupon
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    const validatedData = validateCouponSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Validate the coupon
    const { code, planId } = validatedData.data;
    const validation = await validateCouponCode(code, planId);
    
    return NextResponse.json(validation);
  } catch (error: any) {
    console.error("Error validating coupon:", error);
    
    await createEvent({
      eventType: "COUPON_VALIDATION_ERROR",
      resourceType: "COUPON",
      resourceId: "validate",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to validate coupon", message: error.message },
      { status: 500 }
    );
  }
} 