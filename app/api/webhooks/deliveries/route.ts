import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const webhookEndpointId = searchParams.get('webhookEndpointId');
    const event = searchParams.get('event');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    
    // Check user role and permissions
    const isAdmin = session.user.role === 'ADMIN';
    
    // Build filters
    const filters: any = {};
    
    if (webhookEndpointId) {
      // Check if user has access to this webhook endpoint
      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: webhookEndpointId },
        select: { organizationId: true },
      });
      
      if (!endpoint) {
        return new NextResponse('Webhook endpoint not found', { status: 404 });
      }
      
      // If not admin, verify organization access
      if (!isAdmin) {
        const userOrg = await prisma.userOrganization.findFirst({
          where: {
            userId: session.user.id,
            organizationId: endpoint.organizationId,
          },
        });
        
        if (!userOrg) {
          return new NextResponse('Access denied', { status: 403 });
        }
      }
      
      filters.webhookEndpointId = webhookEndpointId;
    } else if (!isAdmin) {
      // If not admin and no specific webhook, get all user's organizations
      const userOrgs = await prisma.userOrganization.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          organizationId: true,
        },
      });
      
      const orgIds = userOrgs.map(org => org.organizationId);
      
      // Find webhook endpoints for these organizations
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
          organizationId: {
            in: orgIds,
          },
        },
        select: {
          id: true,
        },
      });
      
      const endpointIds = endpoints.map(endpoint => endpoint.id);
      
      if (endpointIds.length === 0) {
        // Return empty results if user has no webhooks
        return NextResponse.json({
          deliveries: [],
          pagination: {
            total: 0,
            page,
            limit,
            pages: 0,
          },
        });
      }
      
      filters.webhookEndpointId = {
        in: endpointIds,
      };
    }
    
    // Add event filter if provided
    if (event) {
      filters.event = event;
    }
    
    // Add status filter if provided
    if (status) {
      filters.status = status;
    }
    
    // Get total count for pagination
    const total = await prisma.webhookDelivery.count({
      where: filters,
    });
    
    // Calculate pagination values
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    
    // Get webhook deliveries
    const deliveries = await prisma.webhookDelivery.findMany({
      where: filters,
      select: {
        id: true,
        webhookEndpointId: true,
        event: true,
        payload: true,
        status: true,
        statusCode: true,
        errorMessage: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
        webhookEndpoint: {
          select: {
            name: true,
            url: true,
            organizationId: true,
            organization: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });
    
    // Format response
    const formattedDeliveries = deliveries.map(delivery => ({
      id: delivery.id,
      webhookEndpointId: delivery.webhookEndpointId,
      endpointName: delivery.webhookEndpoint.name,
      endpointUrl: delivery.webhookEndpoint.url,
      organizationId: delivery.webhookEndpoint.organizationId,
      organizationName: delivery.webhookEndpoint.organization.name,
      event: delivery.event,
      status: delivery.status,
      statusCode: delivery.statusCode,
      errorMessage: delivery.errorMessage,
      attempts: delivery.attempts,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
      payload: delivery.payload,
    }));
    
    // Return webhook deliveries with pagination
    return NextResponse.json({
      deliveries: formattedDeliveries,
      pagination: {
        total,
        page,
        limit,
        pages,
      },
    });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 