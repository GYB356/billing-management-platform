import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createEvent, EventSeverity } from "@/lib/events";
import { rateLimit } from "@/lib/utils/rate-limit";

/**
 * Update phone number for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const { success } = await rateLimit(
      `user-phone-${(await auth())?.user?.id || "unauthenticated"}`,
    );
    if (!success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { phoneNumber } = await req.json();

    // Validate phone number
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Simple phone validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ""))) {
      return NextResponse.json(
        { error: "Invalid phone number format. Please use international format like +1234567890" },
        { status: 400 }
      );
    }

    // In a production app, you would send a verification code via SMS here
    // For this example, we'll assume the phone is verified automatically

    // Update user's phone number
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phoneNumber: phoneNumber,
        phoneVerified: true, // In production, this would be set after verification
        notificationPreferences: {
          ...(await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { notificationPreferences: true },
          }))?.notificationPreferences,
          sms: true,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        phoneVerified: true,
        notificationPreferences: true,
      },
    });

    // Log the event
    await createEvent({
      userId: session.user.id,
      eventType: "PHONE_NUMBER_UPDATED",
      resourceType: "USER_ACCOUNT",
      resourceId: session.user.id,
      severity: EventSeverity.INFO,
      metadata: {
        phoneNumber: phoneNumber,
        verified: true, // In production, this would be false until verified
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        phoneVerified: updatedUser.phoneVerified,
        notificationPreferences: updatedUser.notificationPreferences,
      },
    });
  } catch (error: any) {
    console.error("Error updating phone number:", error);
    return NextResponse.json(
      { error: "Failed to update phone number" },
      { status: 500 }
    );
  }
}

/**
 * Delete phone number for the authenticated user
 */
export async function DELETE() {
  try {
      const { success } = await rateLimit(
        `user-phone-${(await auth())?.user?.id || "unauthenticated"}`,
      );
      if (!success) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }
    
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update user to remove phone number
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phoneNumber: null,
        phoneVerified: false,
        notificationPreferences: {
          ...(await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { notificationPreferences: true },
          }))?.notificationPreferences,
          sms: false,
        },
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
      eventType: "PHONE_NUMBER_REMOVED",
      resourceType: "USER_ACCOUNT",
      resourceId: session.user.id,
      severity: EventSeverity.INFO,
      metadata: {},
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber: null,
        phoneVerified: false,
        notificationPreferences: updatedUser.notificationPreferences,
      },
    });
  } catch (error: any) {
    console.error("Error removing phone number:", error);
    return NextResponse.json(
      { error: "Failed to remove phone number" },
      { status: 500 }
    );
  }
} 