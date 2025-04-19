import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/utils/rate-limit";
import { createEvent, EventSeverity } from "@/lib/events";
import { randomUUID } from "crypto";

/**
 * Register a new push notification subscription for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const { success } = await rateLimit("user-push-subscription");
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      await rateLimit("user-push-subscription", session.user.id);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const subscription = await req.json();

    // Validate subscription
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Valid push subscription is required" },
        { status: 400 }
      );
    }

    // Generate a unique token for this device
    const deviceToken = randomUUID();

    // Store the subscription
    const newDeviceToken = await prisma.deviceToken.create({
      data: {
        userId: session.user.id,
        token: deviceToken,
        platform: "web", // Default to web platform
        pushSubscription: subscription,
      },
    });

    // Update user preferences to enable push notifications
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationPreferences: {
          ...(await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { notificationPreferences: true },
          }))?.notificationPreferences,
          push: true,
        },
      },
    });

    // Log the event
    await createEvent({
      userId: session.user.id,
      eventType: "PUSH_SUBSCRIPTION_CREATED",
      resourceType: "DEVICE_TOKEN",
      resourceId: newDeviceToken.id,
      severity: EventSeverity.INFO,
      metadata: {
        platform: "web",
        endpoint: subscription.endpoint,
      },
    });

    return NextResponse.json({
      success: true,
      deviceToken: deviceToken,
      message: "Push notification subscription registered successfully",
    });
  } catch (error: any) {
    console.error("Error registering push subscription:", error);
    return NextResponse.json(
      { error: "Failed to register push subscription" },
      { status: 500 }
    );
  }
}

/**
 * Update an existing push notification subscription
 */
export async function PUT(req: NextRequest) {
  try {
    const { success } = await rateLimit("user-push-subscription");
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      await rateLimit("user-push-subscription", session.user.id);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { deviceToken, subscription } = await req.json();

    // Validate input
    if (!deviceToken || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Device token and valid subscription are required" },
        { status: 400 }
      );
    }

    // Find the existing device token
    const existingToken = await prisma.deviceToken.findFirst({
      where: {
        userId: session.user.id,
        token: deviceToken,
      },
    });

    if (!existingToken) {
      return NextResponse.json(
        { error: "Device token not found" },
        { status: 404 }
      );
    }

    // Update the subscription
    await prisma.deviceToken.update({
      where: { id: existingToken.id },
      data: {
        pushSubscription: subscription,
        updatedAt: new Date(),
      },
    });

    // Log the event
    await createEvent({
      userId: session.user.id,
      eventType: "PUSH_SUBSCRIPTION_UPDATED",
      resourceType: "DEVICE_TOKEN",
      resourceId: existingToken.id,
      severity: EventSeverity.INFO,
      metadata: {
        platform: existingToken.platform,
        endpoint: subscription.endpoint,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Push notification subscription updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating push subscription:", error);
    return NextResponse.json(
      { error: "Failed to update push subscription" },
      { status: 500 }
    );
  }
}

/**
 * Delete a push notification subscription
 */
export async function DELETE(req: NextRequest) {
  try {
    const { success } = await rateLimit("user-push-subscription");
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      await rateLimit("user-push-subscription", session.user.id);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse URL parameters
    const url = new URL(req.url);
    const deviceToken = url.searchParams.get("deviceToken");

    // Validate deviceToken
    if (!deviceToken) {
      return NextResponse.json(
        { error: "Device token is required" },
        { status: 400 }
      );
    }

    // Find the existing device token
    const existingToken = await prisma.deviceToken.findFirst({
      where: {
        userId: session.user.id,
        token: deviceToken,
      },
    });

    if (!existingToken) {
      return NextResponse.json(
        { error: "Device token not found" },
        { status: 404 }
      );
    }

    // Delete the subscription
    await prisma.deviceToken.delete({
      where: { id: existingToken.id },
    });

    // Check if user has any other devices
    const remainingDevices = await prisma.deviceToken.count({
      where: { userId: session.user.id },
    });

    // If no more devices, update preferences to disable push
    if (remainingDevices === 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          notificationPreferences: {
            ...(await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { notificationPreferences: true },
            }))?.notificationPreferences,
            push: false,
          },
        },
      });
    }

    // Log the event
    await createEvent({
      userId: session.user.id,
      eventType: "PUSH_SUBSCRIPTION_DELETED",
      resourceType: "DEVICE_TOKEN",
      resourceId: existingToken.id,
      severity: EventSeverity.INFO,
      metadata: {
        platform: existingToken.platform,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Push notification subscription deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting push subscription:", error);
    return NextResponse.json(
      { error: "Failed to delete push subscription" },
      { status: 500 }
    );
  }
} 