import { NextResponse } from 'next/server';
import { IntegrationService } from '@/lib/services/integration-service';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('NetSuite OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/settings/integrations?error=${encodeURIComponent(error)}`
        }
      });
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/settings/integrations?error=missing_params'
        }
      });
    }

    // Initialize integration service
    const integrationService = new IntegrationService();

    // Handle OAuth callback
    await integrationService.handleOAuthCallback(
      'netsuite',
      code,
      state
    );

    // Redirect to integration page with success message
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/settings/integrations?success=netsuite_connected'
      }
    });
  } catch (error) {
    console.error('Error handling NetSuite callback:', error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/settings/integrations?error=callback_failed'
      }
    });
  }
}