import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/rbac';
import { AnalyticsService, TimeFrame } from '@/lib/services/analytics-service';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has permission to view analytics
    try {
      requirePermission(
        session.user.role as any,
        session.user.organizationRole as any || 'MEMBER',
        'view:analytics'
      );
    } catch (error) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const timeFrame = (searchParams.get('timeFrame') || 'month') as TimeFrame;
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }
    
    // Check if the user has access to the organization
    const userOrganization = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });
    
    if (!userOrganization && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Organization not found or you do not have permission to access it' },
        { status: 404 }
      );
    }
    
    // Get analytics data
    const analyticsService = new AnalyticsService();
    const dashboardData = await analyticsService.getAnalyticsDashboard(organizationId, timeFrame);
    
    return NextResponse.json(dashboardData);
  } catch (error: any) {
    console.error('Error getting analytics dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get analytics dashboard' },
      { status: 500 }
    );
  }
} 