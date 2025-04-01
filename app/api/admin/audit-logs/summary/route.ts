import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * API route to get audit log summary data for visualizations
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
    const days = parseInt(url.searchParams.get("days") || "30", 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get severity distribution
    const severitySummary = await prisma.$queryRaw`
      SELECT 
        severity, 
        COUNT(*) as count
      FROM 
        events
      WHERE 
        timestamp >= ${startDate}
        AND timestamp <= ${endDate}
      GROUP BY 
        severity
      ORDER BY 
        count DESC
    `;

    // Get event type distribution
    const eventTypeSummary = await prisma.$queryRaw`
      SELECT 
        "eventType", 
        COUNT(*) as count
      FROM 
        events
      WHERE 
        timestamp >= ${startDate}
        AND timestamp <= ${endDate}
      GROUP BY 
        "eventType"
      ORDER BY 
        count DESC
      LIMIT 10
    `;

    // Get trend data by day
    const trendsByDay = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', timestamp) as day,
        severity,
        COUNT(*) as count
      FROM 
        events
      WHERE 
        timestamp >= ${startDate}
        AND timestamp <= ${endDate}
      GROUP BY 
        DATE_TRUNC('day', timestamp), 
        severity
      ORDER BY 
        day
    `;

    // Process trend data into a format suitable for charts
    const trendDays = [];
    const processedTrends: Record<string, any>[] = [];
    
    // Extract unique days
    for (const row of trendsByDay as any[]) {
      const day = new Date(row.day).toISOString().split('T')[0];
      if (!trendDays.includes(day)) {
        trendDays.push(day);
      }
    }
    
    // Create a record for each day with counts for each severity
    for (const day of trendDays) {
      const record: Record<string, any> = { day };
      
      // Initialize all severities to 0
      record.INFO = 0;
      record.WARNING = 0;
      record.ERROR = 0;
      record.CRITICAL = 0;
      
      // Find corresponding data
      for (const row of trendsByDay as any[]) {
        const rowDay = new Date(row.day).toISOString().split('T')[0];
        if (rowDay === day) {
          record[row.severity] = parseInt(row.count);
        }
      }
      
      processedTrends.push(record);
    }

    return NextResponse.json({
      severitySummary,
      eventTypeSummary,
      trends: processedTrends,
      period: {
        startDate,
        endDate,
        days
      }
    });
  } catch (error: any) {
    console.error("Error fetching audit log summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log summary", details: error.message },
      { status: 500 }
    );
  }
} 