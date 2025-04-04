import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  validateRequest,
  requireRole,
  handleApiError,
  ApiError,
} from './security';

type HandlerFunction = (
  req: NextRequest,
  params: { [key: string]: string | string[] }
) => Promise<NextResponse>;

interface HandlerOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  schema?: z.ZodType;
  roles?: string[];
  rateLimit?: {
    limit: number;
    window: string;
  };
}

export function createHandler(
  handler: HandlerFunction,
  options: HandlerOptions = {}
) {
  return async (req: NextRequest, params: { [key: string]: string | string[] }) => {
    try {
      // Method validation
      if (options.method && req.method !== options.method) {
        throw new ApiError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
      }

      // Role-based access control
      if (options.roles) {
        await requireRole(req, options.roles);
      }

      // Request validation
      let validatedData;
      if (options.schema) {
        validatedData = await validateRequest(options.schema, req);
      }

      // Execute handler
      const response = await handler(req, params);

      // Add security headers
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('X-XSS-Protection', '1; mode=block');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      );

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// Example usage:
/*
export const GET = createHandler(
  async (req, params) => {
    // Your handler logic here
    return NextResponse.json({ data: 'success' });
  },
  {
    method: 'GET',
    roles: ['ADMIN'],
    schema: z.object({
      // your schema here
    }),
  }
);
*/ 