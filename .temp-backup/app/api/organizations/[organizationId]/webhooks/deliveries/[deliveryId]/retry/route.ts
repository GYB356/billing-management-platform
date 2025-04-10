import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { retryWebhookDelivery } from "@/lib/services/webhook-service";

// POST - Retry a failed webhook delivery
export async function POST(
  req: NextRequest,
  { params }: { params: { organizationId: string; deliveryId: string } }
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

    // Check if the delivery exists and belongs to the organization
    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id: params.deliveryId,
        webhookEndpoint: {
          organizationId: params.organizationId,
        },
      },
      include: {
        webhookEndpoint: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: "Webhook delivery not found" },
        { status: 404 }
      );
    }

    // Retry the delivery
    const success = await retryWebhookDelivery(params.deliveryId);

    return NextResponse.json({
      success,
      message: success ? "Webhook successfully retried" : "Webhook retry failed",
    });
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    if (error.message === "Webhook delivery not found") {
      return NextResponse.json(
        { error: "Webhook delivery not found" },
        { status: 404 }
      );
    }
    if (error.message === "Cannot retry a successfully delivered webhook") {
      return NextResponse.json(
        { error: "Cannot retry a successfully delivered webhook" },
        { status: 400 }
      );
    }
    if (error.message === "Cannot retry a webhook to an inactive endpoint") {
      return NextResponse.json(
        { error: "Cannot retry a webhook to an inactive endpoint" },
        { status: 400 }
      );
    }
    console.error("Error retrying webhook delivery:", error);
    return NextResponse.json(
      { error: "Failed to retry webhook delivery" },
      { status: 500 }
    );
  }
} 