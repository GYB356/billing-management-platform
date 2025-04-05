import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { 
  getWebhookDeliveries,
  WebhookEventType 
} from "@/lib/services/webhook-service";

// GET - List webhook deliveries for an endpoint
export async function GET(
  req: NextRequest,
  { params }: { params: { organizationId: string; id: string } }
) {
  // Get the user session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    // Check if the user has permissions
    await requirePermission(
      session.user.id,
      params.organizationId,
      "manage-webhooks"
    );

    // Check if the endpoint exists and belongs to the organization
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: {
        id: params.id,
        organizationId: params.organizationId,
      },
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: "Webhook endpoint not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") as "PENDING" | "DELIVERED" | "FAILED" | null;
    const eventType = searchParams.get("eventType") as WebhookEventType | null;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build options
    const options: any = {};
    if (status) options.status = status;
    if (eventType) options.eventType = eventType;
    
    if (startDateStr) {
      const startDate = new Date(startDateStr);
      if (!isNaN(startDate.getTime())) {
        options.startDate = startDate;
      }
    }
    
    if (endDateStr) {
      const endDate = new Date(endDateStr);
      if (!isNaN(endDate.getTime())) {
        options.endDate = endDate;
      }
    }
    
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    // Get deliveries
    const result = await getWebhookDeliveries(params.id, options);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    console.error("Error getting webhook deliveries:", error);
    return NextResponse.json(
      { error: "Failed to get webhook deliveries" },
      { status: 500 }
    );
  }
} 