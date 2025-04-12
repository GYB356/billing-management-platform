/**
 * Integration service for connecting with external ERP/CRM systems
 */

import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';
import { NotificationService } from './notification-service';
<<<<<<< HEAD
import { createHmac } from 'crypto';
import { Queue } from 'bull';
import { redis } from '../redis';
=======
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

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

<<<<<<< HEAD
interface WebhookPayload {
  event: string;
  data: any;
  timestamp: number;
}

interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  retryConfig: {
    maxAttempts: number;
    backoff: number[];
  };
}

export class IntegrationService {
  private readonly notificationService: NotificationService;
  private readonly integrationConfigs: Record<IntegrationType, OAuthConfig>;
  private static webhookQueue = new Queue('webhook-delivery', {
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });
=======
export class IntegrationService {
  private readonly notificationService: NotificationService;
  private readonly integrationConfigs: Record<IntegrationType, OAuthConfig>;
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f

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
<<<<<<< HEAD

  static async registerWebhook(organizationId: string, config: WebhookConfig) {
    try {
      const webhook = await prisma.webhook.create({
        data: {
          organizationId,
          url: config.url,
          secret: config.secret,
          events: config.events,
          retryConfig: config.retryConfig,
          status: 'ACTIVE',
        },
      });

      return webhook;
    } catch (error) {
      console.error('Error registering webhook:', error);
      throw new Error('Failed to register webhook');
    }
  }

  static async deliverWebhook(webhookId: string, payload: WebhookPayload) {
    try {
      const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId },
      });

      if (!webhook) throw new Error('Webhook not found');

      // Create signature
      const signature = this.generateSignature(payload, webhook.secret);

      // Add to delivery queue
      await this.webhookQueue.add(
        'deliver',
        {
          webhookId,
          url: webhook.url,
          payload,
          signature,
          attempt: 1,
        },
        {
          attempts: webhook.retryConfig.maxAttempts,
          backoff: {
            type: 'exponential',
            delay: webhook.retryConfig.backoff[0],
          },
        }
      );

      return { queued: true };
    } catch (error) {
      console.error('Error delivering webhook:', error);
      throw new Error('Failed to deliver webhook');
    }
  }

  static async generateApiKey(organizationId: string, name: string, scopes: string[]) {
    try {
      const key = this.generateSecureToken();
      const hashedKey = this.hashApiKey(key);

      const apiKey = await prisma.apiKey.create({
        data: {
          organizationId,
          name,
          key: hashedKey,
          scopes,
          lastUsed: null,
        },
      });

      // Only return the full key once
      return {
        id: apiKey.id,
        key: `${apiKey.id}_${key}`,
        name: apiKey.name,
        scopes: apiKey.scopes,
      };
    } catch (error) {
      console.error('Error generating API key:', error);
      throw new Error('Failed to generate API key');
    }
  }

  static async validateApiKey(keyString: string): Promise<boolean> {
    try {
      const [keyId, key] = keyString.split('_');

      const apiKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
      });

      if (!apiKey) return false;

      const hashedKey = this.hashApiKey(key);
      const isValid = apiKey.key === hashedKey;

      if (isValid) {
        // Update last used timestamp
        await prisma.apiKey.update({
          where: { id: keyId },
          data: { lastUsed: new Date() },
        });
      }

      return isValid;
    } catch (error) {
      console.error('Error validating API key:', error);
      return false;
    }
  }

  static async revokeApiKey(keyId: string) {
    try {
      await prisma.apiKey.delete({
        where: { id: keyId },
      });

      return { success: true };
    } catch (error) {
      console.error('Error revoking API key:', error);
      throw new Error('Failed to revoke API key');
    }
  }

  private static generateSecureToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  private static hashApiKey(key: string): string {
    return createHmac('sha256', process.env.API_KEY_SECRET || '')
      .update(key)
      .digest('hex');
  }

  private static generateSignature(payload: any, secret: string): string {
    const timestamp = Date.now().toString();
    const stringToSign = `${timestamp}.${JSON.stringify(payload)}`;
    
    return createHmac('sha256', secret)
      .update(stringToSign)
      .digest('hex');
  }

  static async getIntegrationStatus(organizationId: string) {
    try {
      const [webhooks, apiKeys] = await Promise.all([
        prisma.webhook.findMany({
          where: { organizationId },
          select: {
            id: true,
            url: true,
            events: true,
            status: true,
            lastSuccess: true,
            lastFailure: true,
          },
        }),
        prisma.apiKey.findMany({
          where: { organizationId },
          select: {
            id: true,
            name: true,
            scopes: true,
            createdAt: true,
            lastUsed: true,
          },
        }),
      ]);

      return {
        webhooks: webhooks.map(webhook => ({
          ...webhook,
          health: this.calculateWebhookHealth(webhook),
        })),
        apiKeys: apiKeys.map(key => ({
          ...key,
          active: key.lastUsed && 
            new Date().getTime() - new Date(key.lastUsed).getTime() < 30 * 24 * 60 * 60 * 1000,
        })),
      };
    } catch (error) {
      console.error('Error getting integration status:', error);
      throw new Error('Failed to get integration status');
    }
  }

  private static calculateWebhookHealth(webhook: any) {
    if (!webhook.lastSuccess && !webhook.lastFailure) return 'UNKNOWN';
    if (!webhook.lastFailure) return 'HEALTHY';
    if (!webhook.lastSuccess) return 'FAILING';

    const lastSuccessTime = new Date(webhook.lastSuccess).getTime();
    const lastFailureTime = new Date(webhook.lastFailure).getTime();

    return lastSuccessTime > lastFailureTime ? 'HEALTHY' : 'FAILING';
  }
=======
>>>>>>> 4f9d35bd5c5bf095848f6fc99f7e7bfe5212365f
}