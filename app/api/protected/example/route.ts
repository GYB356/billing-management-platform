import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/middleware/rateLimit";
import type { NextRequest } from "next/server";

// Custom rate limit for this endpoint
const RATE_LIMIT_CONFIG = {
  limit: 50,    // 50 requests
  window: 300,  // per 5 minutes
};

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMIT_CONFIG);
  if (rateLimitResponse.status !== 200) {
    return rateLimitResponse;
  }

  // Get the authenticated user ID from the middleware
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Example: Fetch user's data
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        // Add other fields as needed
      }
    });

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Protected data retrieved successfully",
      data: userData
    });
  } catch (error) {
    console.error('Error in protected route:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMIT_CONFIG);
  if (rateLimitResponse.status !== 200) {
    return rateLimitResponse;
  }

  // Get the authenticated user ID from the middleware
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Example: Create a resource for the user
    const resource = await prisma.resource.create({
      data: {
        ...body,
        userId
      }
    });

    return NextResponse.json({
      message: "Resource created successfully",
      data: resource
    });
  } catch (error) {
    console.error('Error in protected route:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 