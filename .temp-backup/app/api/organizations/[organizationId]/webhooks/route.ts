import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { 
  createWebhookEndpoint,
  getWebhookEndpoints,
  WebhookEventType 
} from "@/lib/services/webhook-service";

// Webhook endpoint creation schema
const webhookEndpointSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16),
  description: z.string().min(1).max(255),
  eventTypes: z.array(z.nativeEnum(WebhookEventType)).min(1),
  isActive: z.boolean().optional(),
});

// GET - List webhook endpoints for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const isActive = searchParams.get("isActive");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build options
    const options: any = {};
    if (isActive !== null) options.isActive = isActive === "true";
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    // Get endpoints
    const result = await getWebhookEndpoints(params.organizationId, options);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    console.error("Error getting webhook endpoints:", error);
    return NextResponse.json(
      { error: "Failed to get webhook endpoints" },
      { status: 500 }
    );
  }
}

// POST - Create a new webhook endpoint
export async function POST(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
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

    // Parse and validate request body
    const body = await req.json();
    const validationResult = webhookEndpointSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { url, secret, description, eventTypes, isActive } = validationResult.data;

    // Create webhook endpoint
    const endpoint = await createWebhookEndpoint(
      params.organizationId,
      url,
      secret,
      description,
      eventTypes,
      isActive
    );

    return NextResponse.json(endpoint, { status: 201 });
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    if (error.message === "Organization not found") {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }
    console.error("Error creating webhook endpoint:", error);
    return NextResponse.json(
      { error: "Failed to create webhook endpoint" },
      { status: 500 }
    );
  }
} 