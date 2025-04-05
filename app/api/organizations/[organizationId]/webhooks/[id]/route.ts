import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { 
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  WebhookEventType 
} from "@/lib/services/webhook-service";

// Webhook endpoint update schema
const webhookEndpointUpdateSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(16).optional(),
  description: z.string().min(1).max(255).optional(),
  eventTypes: z.array(z.nativeEnum(WebhookEventType)).min(1).optional(),
  isActive: z.boolean().optional(),
});

// GET - Get a single webhook endpoint
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

    // Get the endpoint
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

    return NextResponse.json(endpoint);
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    console.error("Error getting webhook endpoint:", error);
    return NextResponse.json(
      { error: "Failed to get webhook endpoint" },
      { status: 500 }
    );
  }
}

// PATCH - Update a webhook endpoint
export async function PATCH(
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
    const existingEndpoint = await prisma.webhookEndpoint.findUnique({
      where: {
        id: params.id,
        organizationId: params.organizationId,
      },
    });

    if (!existingEndpoint) {
      return NextResponse.json(
        { error: "Webhook endpoint not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = webhookEndpointUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    // Update the endpoint
    const updatedEndpoint = await updateWebhookEndpoint(
      params.id,
      validationResult.data
    );

    return NextResponse.json(updatedEndpoint);
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    if (error.message === "Webhook endpoint not found") {
      return NextResponse.json(
        { error: "Webhook endpoint not found" },
        { status: 404 }
      );
    }
    console.error("Error updating webhook endpoint:", error);
    return NextResponse.json(
      { error: "Failed to update webhook endpoint" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a webhook endpoint
export async function DELETE(
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
    const existingEndpoint = await prisma.webhookEndpoint.findUnique({
      where: {
        id: params.id,
        organizationId: params.organizationId,
      },
    });

    if (!existingEndpoint) {
      return NextResponse.json(
        { error: "Webhook endpoint not found" },
        { status: 404 }
      );
    }

    // Delete the endpoint
    await deleteWebhookEndpoint(params.id);

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    if (error.message === "Webhook endpoint not found") {
      return NextResponse.json(
        { error: "Webhook endpoint not found" },
        { status: 404 }
      );
    }
    console.error("Error deleting webhook endpoint:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook endpoint" },
      { status: 500 }
    );
  }
} 