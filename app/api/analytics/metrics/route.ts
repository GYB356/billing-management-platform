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
    const metric = searchParams.get('metric');
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }
    
    if (!metric) {
      return NextResponse.json({ error: 'Metric type is required' }, { status: 400 });
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
    
    // Get analytics data based on the requested metric
    const analyticsService = new AnalyticsService();
    
    let data;
    
    switch (metric) {
      case 'revenue':
        data = await analyticsService.getRevenueAnalytics(organizationId, timeFrame);
        break;
      case 'subscriptions':
        data = await analyticsService.getSubscriptionAnalytics(organizationId, timeFrame);
        break;
      case 'customers':
        data = await analyticsService.getCustomerAnalytics(organizationId, timeFrame);
        break;
      case 'invoices':
        data = await analyticsService.getInvoiceAnalytics(organizationId, timeFrame);
        break;
      case 'revenueTimeSeries':
        data = await analyticsService.getRevenueTimeSeries(organizationId, timeFrame);
        break;
      case 'subscriptionTimeSeries':
        data = await analyticsService.getSubscriptionTimeSeries(organizationId, timeFrame);
        break;
      case 'topPlans':
        const limit = parseInt(searchParams.get('limit') || '5');
        data = await analyticsService.getTopPlans(organizationId, limit);
        break;
      case 'customerRetention':
        const months = parseInt(searchParams.get('months') || '12');
        data = await analyticsService.getCustomerRetention(organizationId, months);
        break;
      default:
        return NextResponse.json({ error: 'Invalid metric type' }, { status: 400 });
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting analytics metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get analytics metrics' },
      { status: 500 }
    );
  }
} 