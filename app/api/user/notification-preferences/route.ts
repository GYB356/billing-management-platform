import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NotificationPreferences } from "@/lib/types";
import { createEvent, EventSeverity } from "@/lib/events";

/**
 * GET notification preferences for the authenticated user
 */
export async function GET() {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user with preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        phoneNumber: true,
        notificationPreferences: true,
        deviceTokens: {
          select: {
            id: true,
            token: true,
            platform: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the device token if available
    const deviceToken = user.deviceTokens.length > 0 ? user.deviceTokens[0].token : null;

    return NextResponse.json({
      preferences: user.notificationPreferences || {
        email: true,
        inApp: true,
        sms: false,
        push: false,
        types: {
          billing: true,
          security: true,
          updates: true,
          promotions: false,
        },
      },
      phoneNumber: user.phoneNumber,
      deviceToken,
    });
  } catch (error: any) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

/**
 * Update notification preferences for the authenticated user
 */
export async function PUT(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { preferences } = await req.json();

    // Validate preferences
    if (!preferences) {
      return NextResponse.json(
        { error: "Preferences are required" },
        { status: 400 }
      );
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationPreferences: preferences as NotificationPreferences,
      },
      select: {
        id: true,
        name: true,
        email: true,
        notificationPreferences: true,
      },
    });

    // Log the event
    await createEvent({
      userId: session.user.id,
      eventType: "USER_PREFERENCES_UPDATED",
      resourceType: "USER_ACCOUNT",
      resourceId: session.user.id,
      severity: EventSeverity.INFO,
      metadata: {
        notificationPreferences: preferences,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        notificationPreferences: updatedUser.notificationPreferences,
      },
    });
  } catch (error: any) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
} 