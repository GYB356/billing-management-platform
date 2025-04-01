import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Common validation schemas
export const paginationSchema = z.object({
  page: z.string().optional().transform(val => Number(val) || 1),
  limit: z.string().optional().transform(val => Number(val) || 10),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(100),
  ...paginationSchema.shape,
});

// API error response helper
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Request validation middleware
export async function validateRequest<T extends z.ZodType>(
  schema: T,
  req: NextRequest
): Promise<z.infer<T>> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, 'Invalid request data', 'VALIDATION_ERROR');
    }
    throw new ApiError(400, 'Invalid JSON body', 'INVALID_JSON');
  }
}

// Role-based access control
export async function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): Promise<void> {
  const token = await getToken({ req });
  
  if (!token) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  if (!allowedRoles.includes(token.role as string)) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
}

// Rate limiting helper
export function rateLimitResponse(
  limit: number,
  remaining: number,
  reset: number
): NextResponse {
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    },
  });
}

// Error handling middleware
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  console.error('Unhandled error:', error);

  return NextResponse.json(
    {
      error: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
    },
    { status: 500 }
  );
}

// Request sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit input length
}

// API response wrapper
export function apiResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
} 