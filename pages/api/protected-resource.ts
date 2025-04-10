import { NextApiResponse } from 'next';
import { withApiAuth, AuthenticatedRequest } from '@/middleware/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // This endpoint requires the 'read:resource' scope
  // The middleware will handle the authentication and scope checking
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Example protected resource data
    const protectedData = {
      id: '123',
      name: 'Protected Resource',
      description: 'This is a protected resource that requires API token authentication',
      accessedBy: req.apiToken?.userId,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(protectedData);
  } catch (error) {
    console.error('Error accessing protected resource:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Wrap the handler with API authentication middleware
// Require the 'read:resource' scope to access this endpoint
export default withApiAuth(handler, { requiredScopes: ['read:resource'] }); 