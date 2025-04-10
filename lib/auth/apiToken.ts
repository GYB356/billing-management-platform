import { prisma } from "@/lib/db";
import { ApiToken } from "@prisma/client";
import { randomBytes } from "crypto";

interface GenerateApiTokenOptions {
  userId: string;
  name: string;
  expiresIn?: number; // Expiration in days
  scopes?: string[]; // Array of permission scopes
}

export class InvalidApiTokenError extends Error {
  constructor(message: string = 'Invalid API token') {
    super(message);
    this.name = 'InvalidApiTokenError';
  }
}

export class ExpiredApiTokenError extends Error {
  constructor(message: string = 'API token has expired') {
    super(message);
    this.name = 'ExpiredApiTokenError';
  }
}

export class InsufficientScopeError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'InsufficientScopeError';
  }
}

export interface ApiToken {
  id: string;
  token: string;
  userId: string;
  scopes: string[];
  name: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generates a new API token for a user
 * @param options Token generation options including userId and name
 * @returns The created API token
 */
export async function generateApiToken(options: GenerateApiTokenOptions): Promise<ApiToken> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = options.expiresIn 
    ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
    : null;

  try {
    return await prisma.apiToken.create({
      data: {
        userId: options.userId,
        name: options.name,
        token,
        expiresAt,
        scopes: options.scopes || []
      }
    });
  } catch (error) {
    console.error('Failed to generate API token:', error);
    throw new Error('Failed to generate API token');
  }
}

/**
 * Verifies an API token and returns the associated token record if valid
 * @param token The token string to verify
 * @param requiredScopes Optional array of required scopes
 * @returns The API token record if valid, null if not found
 * @throws InvalidApiTokenError if token is invalid
 * @throws ExpiredApiTokenError if token is expired
 * @throws InsufficientScopeError if token does not have required scopes
 */
export async function verifyApiToken(token: string, requiredScopes?: string[]): Promise<ApiToken> {
  if (!token || typeof token !== 'string') {
    throw new InvalidApiTokenError('Token must be a non-empty string');
  }

  try {
    const apiToken = await prisma.apiToken.findUnique({
      where: { token }
    });

    if (!apiToken) {
      throw new InvalidApiTokenError();
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      throw new ExpiredApiTokenError();
    }

    // Check if token has required scopes
    if (requiredScopes && requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every(scope => 
        apiToken.scopes.includes(scope)
      );
      
      if (!hasAllScopes) {
        throw new InsufficientScopeError();
      }
    }

    // Update last used timestamp and usage count
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { 
        lastUsedAt: new Date(),
        usageCount: {
          increment: 1
        }
      }
    });

    return apiToken;
  } catch (error) {
    if (error instanceof InvalidApiTokenError || 
        error instanceof ExpiredApiTokenError ||
        error instanceof InsufficientScopeError) {
      throw error;
    }
    console.error('Error verifying API token:', error);
    throw new Error('Failed to verify API token');
  }
}

/**
 * Records API token usage for analytics
 * @param tokenId The ID of the token to record usage for
 * @param endpoint The endpoint accessed
 * @param method The HTTP method used
 * @param statusCode The HTTP status code of the response
 * @param ipAddress Optional IP address of the request
 * @param userAgent Optional user agent of the request
 * @param responseTime Optional response time in milliseconds
 */
export async function recordApiTokenUsage(
  tokenId: string, 
  endpoint: string, 
  method: string, 
  statusCode: number,
  ipAddress?: string,
  userAgent?: string,
  responseTime?: number
): Promise<void> {
  try {
    await prisma.apiTokenUsage.create({
      data: {
        tokenId,
        endpoint,
        method,
        statusCode,
        ipAddress,
        userAgent,
        responseTime
      }
    });
  } catch (error) {
    console.error('Failed to record API token usage:', error);
    // Don't throw, just log the error
  }
}

/**
 * Lists all active API tokens for a user
 * @param userId The user ID to list tokens for
 * @returns Array of API tokens
 */
export async function listUserApiTokens(userId: string): Promise<ApiToken[]> {
  try {
    return await prisma.apiToken.findMany({
      where: { 
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    console.error('Failed to list API tokens:', error);
    throw new Error('Failed to list API tokens');
  }
}

/**
 * Revokes (deletes) an API token
 * @param tokenId The ID of the token to revoke
 * @param userId Optional user ID to verify token ownership
 * @returns The revoked token
 */
export async function revokeApiToken(tokenId: string, userId?: string): Promise<ApiToken> {
  try {
    const where: { id: string; userId?: string } = { id: tokenId };
    if (userId) {
      where.userId = userId;
    }

    return await prisma.apiToken.delete({
      where
    });
  } catch (error) {
    console.error('Failed to revoke API token:', error);
    throw new Error('Failed to revoke API token');
  }
}

/**
 * Gets token usage analytics
 * @param tokenId The ID of the token to get analytics for
 * @param startDate Optional start date to filter analytics
 * @param endDate Optional end date to filter analytics
 * @returns Token usage analytics
 */
export async function getTokenUsageAnalytics(
  tokenId: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const where: any = { tokenId };
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const usage = await prisma.apiTokenUsage.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });

    // Calculate summary statistics
    const totalRequests = usage.length;
    const successCount = usage.filter(u => u.statusCode >= 200 && u.statusCode < 300).length;
    const errorCount = totalRequests - successCount;
    
    // Group by endpoint
    const endpointStats = usage.reduce((acc, curr) => {
      if (!acc[curr.endpoint]) {
        acc[curr.endpoint] = {
          count: 0,
          successCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
          totalResponseTime: 0
        };
      }
      
      acc[curr.endpoint].count++;
      if (curr.statusCode >= 200 && curr.statusCode < 300) {
        acc[curr.endpoint].successCount++;
      } else {
        acc[curr.endpoint].errorCount++;
      }
      
      if (curr.responseTime) {
        acc[curr.endpoint].totalResponseTime += curr.responseTime;
        acc[curr.endpoint].avgResponseTime = 
          acc[curr.endpoint].totalResponseTime / acc[curr.endpoint].count;
      }
      
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRequests,
      successCount,
      errorCount,
      successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
      endpointStats
    };
  } catch (error) {
    console.error('Failed to get token usage analytics:', error);
    throw new Error('Failed to get token usage analytics');
  }
}

/**
 * Creates a new API token in the database
 * @param token The API token data to create
 * @returns The created API token
 */
export async function createApiToken(token: Omit<ApiToken, 'id'>): Promise<ApiToken> {
  return prisma.apiToken.create({
    data: token
  });
}

/**
 * Retrieves an API token by its token string
 * @param token The API token string to look up
 * @returns The API token if found, null otherwise
 */
export async function getApiToken(token: string): Promise<ApiToken | null> {
  return prisma.apiToken.findUnique({
    where: { token }
  });
}

/**
 * Updates an existing API token
 * @param token The API token string to update
 * @param data The data to update
 * @returns The updated API token
 */
export async function updateApiToken(token: string, data: Partial<ApiToken>): Promise<ApiToken> {
  return prisma.apiToken.update({
    where: { token },
    data
  });
}

/**
 * Deletes an API token
 * @param token The API token string to delete
 * @returns The deleted API token
 */
export async function deleteApiToken(token: string): Promise<ApiToken> {
  return prisma.apiToken.delete({
    where: { token }
  });
}

/**
 * Lists all API tokens for a user
 * @param userId The user ID to list tokens for
 * @returns Array of API tokens
 */
export async function listApiTokens(userId: string): Promise<ApiToken[]> {
  return prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
} 