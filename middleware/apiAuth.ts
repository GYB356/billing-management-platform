import { NextApiRequest, NextApiResponse } from 'next';
import { verifyApiToken, recordApiTokenUsage, InsufficientScopeError } from '@/lib/auth/apiToken';

export interface AuthenticatedRequest extends NextApiRequest {
  apiToken?: {
    id: string;
    userId: string;
    scopes: string[];
  };
}

type ApiHandler = (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>;

interface ApiAuthOptions {
  requiredScopes?: string[];
}

/**
 * Middleware to authenticate API requests using API tokens
 */
export function withApiAuth(handler: ApiHandler, options: ApiAuthOptions = {}) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const startTime = Date.now();

      try {
        // Verify token and check scopes
        const apiToken = await verifyApiToken(token, options.requiredScopes);
        
        // Attach token info to request
        req.apiToken = {
          id: apiToken.id,
          userId: apiToken.userId,
          scopes: apiToken.scopes
        };

        // Call the handler
        await handler(req, res);

        // Record successful usage
        await recordApiTokenUsage(
          apiToken.id,
          req.url || '',
          req.method || '',
          res.statusCode,
          req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
          req.headers['user-agent'],
          Date.now() - startTime
        );

      } catch (error) {
        // Record failed usage if we have a token
        if (req.apiToken) {
          await recordApiTokenUsage(
            req.apiToken.id,
            req.url || '',
            req.method || '',
            error instanceof InsufficientScopeError ? 403 : 401,
            req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
            req.headers['user-agent'],
            Date.now() - startTime
          );
        }

        if (error instanceof InsufficientScopeError) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        throw error;
      }

    } catch (error) {
      console.error('API authentication error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
} 