import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EventSeverity } from "@/lib/events";
import { auth } from "@/lib/auth";

/**
 * API route to get audit logs with filtering
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const severity = url.searchParams.get("severity") || undefined;
    const resourceType = url.searchParams.get("resourceType") || undefined;
    const startDate = url.searchParams.get("startDate") ? new Date(url.searchParams.get("startDate")!) : undefined;
    const endDate = url.searchParams.get("endDate") ? new Date(url.searchParams.get("endDate")!) : undefined;
    const search = url.searchParams.get("search") || undefined;

    // Build the where clause
    const where: any = {};

    if (severity) {
      where.severity = severity as EventSeverity;
    }

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        // Include the entire end date by setting to the next day at midnight
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        where.timestamp.lt = nextDay;
      }
    }

    if (search) {
      where.OR = [
        { eventType: { contains: search, mode: "insensitive" } },
        { resourceId: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get the total count
    const totalCount = await prisma.event.count({ where });

    // Get the events with pagination
    const events = await prisma.event.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      events,
      totalCount,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs", details: error.message },
      { status: 500 }
    );
  }
} 