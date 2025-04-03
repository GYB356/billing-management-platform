import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { requirePermission } from "@/lib/require-permission";
import { getWebhookStats } from "@/lib/services/event-webhook-service";

// GET - Get webhook stats for an organization
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

    // Get webhook stats
    const stats = await getWebhookStats(params.organizationId);

    return NextResponse.json(stats);
  } catch (error: any) {
    if (error.message === "Permission denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    console.error("Error getting webhook stats:", error);
    return NextResponse.json(
      { error: "Failed to get webhook stats" },
      { status: 500 }
    );
  }
} 