import { NextRequest, NextResponse } from "next/server";
import { createPromotion, getActivePromotions } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { z } from "zod";

// Validation schema for creating a promotion
const createPromotionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountAmount: z.number().positive("Discount amount must be positive"),
  currency: z.string().optional(),
  startDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  endDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  maxRedemptions: z.number().optional(),
  applicablePlans: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

// GET handler to list promotions
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const active = url.searchParams.get("active");
    const planId = url.searchParams.get("planId");
    
    // Fetch promotions
    let promotions;
    if (active === "true" && planId) {
      promotions = await getActivePromotions(planId);
    } else if (active === "true") {
      promotions = await getActivePromotions();
    } else {
      // Get all promotions
      promotions = await prisma.promotion.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          coupons: true,
        },
      });
    }

    return NextResponse.json(promotions);
  } catch (error: any) {
    console.error("Error fetching promotions:", error);
    
    await createEvent({
      eventType: "PROMOTION_LIST_ERROR",
      resourceType: "PROMOTION",
      resourceId: "all",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to fetch promotions" },
      { status: 500 }
    );
  }
}

// POST handler to create a promotion
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
    const validatedData = createPromotionSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    // Create promotion
    const promotion = await createPromotion(validatedData.data);
    
    return NextResponse.json(promotion, { status: 201 });
  } catch (error: any) {
    console.error("Error creating promotion:", error);
    
    await createEvent({
      eventType: "PROMOTION_CREATE_ERROR",
      resourceType: "PROMOTION",
      resourceId: "new",
      severity: EventSeverity.ERROR,
      metadata: {
        error: error.message,
      },
    });
    
    return NextResponse.json(
      { error: "Failed to create promotion", message: error.message },
      { status: 500 }
    );
  }
} 