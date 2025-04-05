/**
 * Integration service for connecting with external ERP/CRM systems
 */

import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';
import { NotificationService } from './notification-service';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
}

type IntegrationType = 'quickbooks' | 'xero' | 'netsuite' | 'salesforce' | 'hubspot';

export class IntegrationService {
  private readonly notificationService: NotificationService;
  private readonly integrationConfigs: Record<IntegrationType, OAuthConfig>;

  constructor() {
    this.notificationService = new NotificationService();
    
    if (!process.env.OAUTH_REDIRECT_BASE_URL) {
      throw new Error('OAUTH_REDIRECT_BASE_URL is not set');
    }

    // Initialize OAuth configurations for supported integrations
    this.integrationConfigs = {
      quickbooks: {
        clientId: process.env.QUICKBOOKS_CLIENT_ID!,
        clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
        redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL}/quickbooks/callback`,
        scopes: ['com.intuit.quickbooks.accounting'],
        authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
        tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
      },
      xero: {
        clientId: process.env.XERO_CLIENT_ID!,
        clientSecret: process.env.XERO_CLIENT_SECRET!,
        redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL}/xero/callback`,
        scopes: ['accounting.transactions', 'accounting.settings'],
        authorizationUrl: 'https://login.xero.com/identity/connect/authorize',
        tokenUrl: 'https://identity.xero.com/connect/token'
      },
      netsuite: {
        clientId: process.env.NETSUITE_CLIENT_ID!,
        clientSecret: process.env.NETSUITE_CLIENT_SECRET!,
        redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL}/netsuite/callback`,
        scopes: ['rest_webservices'],
        authorizationUrl: 'https://system.netsuite.com/app/login/oauth2/authorize.nl',
        tokenUrl: 'https://system.netsuite.com/app/login/oauth2/token.nl'
      },
      salesforce: {
        clientId: process.env.SALESFORCE_CLIENT_ID!,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
        redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL}/salesforce/callback`,
        scopes: ['api', 'refresh_token'],
        authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token'
      },
      hubspot: {
        clientId: process.env.HUBSPOT_CLIENT_ID!,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET!,
        redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL}/hubspot/callback`,
        scopes: ['crm.objects.contacts.read', 'crm.objects.companies.read'],
        authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token'
      }
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  public getAuthorizationUrl(
    integrationType: IntegrationType,
    organizationId: string,
    state?: string
  ): string {
    const config = this.integrationConfigs[integrationType];
    if (!config) {
      throw new Error(`Unsupported integration type: ${integrationType}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state || this.generateState(organizationId)
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and save integration
   */
  public async handleOAuthCallback(
    integrationType: IntegrationType,
    code: string,
    state: string
  ): Promise<void> {
    const config = this.integrationConfigs[integrationType];
    if (!config) {
      throw new Error(`Unsupported integration type: ${integrationType}`);
    }

    // Verify state and extract organization ID
    const organizationId = this.verifyState(state);
    if (!organizationId) {
      throw new Error('Invalid state parameter');
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(config, code);

    // Save integration
    await this.saveIntegration(
      integrationType,
      organizationId,
      tokens
    );

    // Notify about successful integration
    await this.notificationService.sendNotification({
      userId: (await this.getOrganizationOwner(organizationId))?.id!,
      title: 'Integration Connected',
      message: `Successfully connected ${integrationType} integration`,
      type: 'SUCCESS',
      channels: ['EMAIL', 'IN_APP']
    });
  }

  /**
   * Exchange authorization code for OAuth tokens
   */
  private async exchangeCodeForTokens(
    config: OAuthConfig,
    code: string
  ): Promise<OAuthToken> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      tokenType: data.token_type,
      scope: data.scope
    };
  }

  /**
   * Save integration details to database
   */
  private async saveIntegration(
    type: IntegrationType,
    organizationId: string,
    tokens: OAuthToken
  ): Promise<void> {
    await prisma.integration.upsert({
      where: {
        organizationId_type: {
          organizationId,
          type
        }
      },
      create: {
        organizationId,
        type,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        status: 'ACTIVE'
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    });

    await createEvent({
      type: 'INTEGRATION_CONNECTED',
      organizationId,
      metadata: {
        integrationType: type
      }
    });
  }

  /**
   * Generate state parameter for OAuth flow
   */
  private generateState(organizationId: string): string {
    return Buffer.from(JSON.stringify({
      organizationId,
      timestamp: Date.now()
    })).toString('base64');
  }

  /**
   * Verify state parameter and extract organization ID
   */
  private verifyState(state: string): string | null {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, 'base64').toString()
      );

      // Verify timestamp is not too old (prevent replay attacks)
      if (Date.now() - decoded.timestamp > 1000 * 60 * 10) { // 10 minutes
        return null;
      }

      return decoded.organizationId;
    } catch {
      return null;
    }
  }

  /**
   * Get organization owner
   */
  private async getOrganizationOwner(organizationId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        userOrganizations: {
          where: { role: 'OWNER' },
          include: { user: true }
        }
      }
    });

    return organization?.userOrganizations[0]?.user;
  }

  /**
   * List active integrations for an organization
   */
  public async listIntegrations(organizationId: string) {
    return prisma.integration.findMany({
      where: {
        organizationId,
        status: 'ACTIVE'
      }
    });
  }

  /**
   * Disconnect an integration
   */
  public async disconnectIntegration(
    organizationId: string,
    type: IntegrationType
  ): Promise<void> {
    await prisma.integration.update({
      where: {
        organizationId_type: {
          organizationId,
          type
        }
      },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date()
      }
    });

    await createEvent({
      type: 'INTEGRATION_DISCONNECTED',
      organizationId,
      metadata: {
        integrationType: type
      }
    });
  }
}