import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anonymizeUser } from "@/lib/privacy/anonymizeUser";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/logging/audit";
import { UserPreferences } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, data } = await req.json();
    const userId = session.user.id;

    switch (action) {
      case "export":
        // Export user data
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            // Add other fields you want to export
          }
        });

        // Log the export action
        await logAudit({
          userId,
          action: "privacy.data_export",
          description: "User requested data export"
        });

        return NextResponse.json({ data: userData });

      case "delete":
        // Anonymize user data
        await anonymizeUser(userId);

        // Log the deletion request
        await logAudit({
          userId,
          action: "privacy.account_deletion",
          description: "User requested account deletion"
        });

        return NextResponse.json({ success: true });

      case "update":
        // Update user preferences
        if (data?.preferences) {
          // Update user preferences in the UserPreferences table
          await prisma.userPreferences.upsert({
            where: { userId },
            create: {
              userId,
              ...data.preferences
            },
            update: {
              ...data.preferences
            }
          });

          // Log the preferences update
          await logAudit({
            userId,
            action: "privacy.preferences_updated",
            description: "User updated privacy preferences"
          });
        }

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Privacy rights error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 