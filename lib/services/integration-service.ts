/**
 * Integration service for connecting with external ERP/CRM systems
 */

import { prisma } from '../prisma';
import { createEvent, EventSeverity } from '../events';
import { Webhook } from '@prisma/client';
import crypto from 'crypto';

// External system types
export enum IntegrationType {
  SALESFORCE = 'SALESFORCE',
  HUBSPOT = 'HUBSPOT',
  ZOHO = 'ZOHO',
  PIPEDRIVE = 'PIPEDRIVE',
  DYNAMICS_365 = 'DYNAMICS_365',
  NETSUITE = 'NETSUITE',
  ZENDESK = 'ZENDESK',
  FRESHDESK = 'FRESHDESK',
  CUSTOM_API = 'CUSTOM_API',
  WEBHOOK = 'WEBHOOK'
}

// Event types for synchronization
export enum IntegrationEventType {
  CUSTOMER_CREATED = 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED = 'CUSTOMER_UPDATED',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_PAID = 'INVOICE_PAID',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED'
}

// Integration configuration
export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  enabled: boolean;
  credentials: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    instanceUrl?: string;
    username?: string;
    password?: string;
    [key: string]: any;
  };
  settings: {
    syncEvents: IntegrationEventType[];
    syncDirection: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
    fieldMappings?: Record<string, string>;
    webhookUrl?: string;
    webhookSecret?: string;
    syncInterval?: number; // in minutes
    batchSize?: number;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

// Webhook payload
export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

export class IntegrationService {
  /**
   * Create a new integration
   */
  static async createIntegration(
    organizationId: string,
    config: IntegrationConfig
  ) {
    try {
      // Validate config
      this.validateConfig(config);
      
      // Check if integration already exists
      const existingIntegration = await prisma.integration.findFirst({
        where: {
          organizationId,
          type: config.type,
          name: config.name
        }
      });
      
      if (existingIntegration) {
        throw new Error(`Integration ${config.name} already exists for this organization`);
      }
      
      // Create the integration
      const integration = await prisma.integration.create({
        data: {
          organizationId,
          type: config.type,
          name: config.name,
          enabled: config.enabled,
          credentials: config.credentials,
          settings: config.settings,
          metadata: config.metadata || {}
        }
      });
      
      // If this is a webhook integration, create webhook
      if (config.type === IntegrationType.WEBHOOK && config.settings.webhookUrl) {
        await prisma.webhook.create({
          data: {
            organizationId,
            url: config.settings.webhookUrl,
            secret: config.settings.webhookSecret,
            events: config.settings.syncEvents,
            active: config.enabled,
            integrationId: integration.id
          }
        });
      }
      
      // Log event
      await createEvent({
        eventType: 'INTEGRATION_CREATED',
        resourceType: 'INTEGRATION',
        resourceId: integration.id,
        organizationId,
        severity: EventSeverity.INFO,
        metadata: {
          type: config.type,
          name: config.name
        }
      });
      
      return integration;
    } catch (error) {
      console.error('Error creating integration:', error);
      
      // Log error
      await createEvent({
        eventType: 'INTEGRATION_CREATION_FAILED',
        resourceType: 'INTEGRATION',
        organizationId,
        severity: EventSeverity.ERROR,
        metadata: {
          type: config.type,
          name: config.name,
          error: (error as Error).message
        }
      });
      
      throw error;
    }
  }

  /**
   * Update an existing integration
   */
  static async updateIntegration(
    integrationId: string,
    updates: Partial<IntegrationConfig>
  ) {
    // Validate any provided config options
    if (updates.settings) {
      this.validateSettingsForUpdate(updates.settings);
    }
    
    // Update the integration
    const integration = await prisma.integration.update({
      where: { id: integrationId },
      data: {
        name: updates.name,
        enabled: updates.enabled,
        credentials: updates.credentials,
        settings: updates.settings,
        metadata: updates.metadata
      }
    });
    
    // If this is a webhook integration, update the webhook
    if (integration.type === IntegrationType.WEBHOOK && updates.settings?.webhookUrl) {
      await prisma.webhook.updateMany({
        where: { integrationId },
        data: {
          url: updates.settings.webhookUrl,
          secret: updates.settings.webhookSecret,
          events: updates.settings.syncEvents,
          active: updates.enabled
        }
      });
    }
    
    // Log event
    await createEvent({
      eventType: 'INTEGRATION_UPDATED',
      resourceType: 'INTEGRATION',
      resourceId: integrationId,
      organizationId: integration.organizationId,
      severity: EventSeverity.INFO,
      metadata: {
        type: integration.type,
        name: integration.name
      }
    });
    
    return integration;
  }

  /**
   * Delete an integration
   */
  static async deleteIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId }
    });
    
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }
    
    // Delete associated webhooks
    await prisma.webhook.deleteMany({
      where: { integrationId }
    });
    
    // Delete the integration
    await prisma.integration.delete({
      where: { id: integrationId }
    });
    
    // Log event
    await createEvent({
      eventType: 'INTEGRATION_DELETED',
      resourceType: 'INTEGRATION',
      resourceId: integrationId,
      organizationId: integration.organizationId,
      severity: EventSeverity.INFO,
      metadata: {
        type: integration.type,
        name: integration.name
      }
    });
    
    return { success: true };
  }

  /**
   * Test an integration connection
   */
  static async testIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId }
    });
    
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }
    
    try {
      let result: any;
      
      // Test based on integration type
      switch (integration.type) {
        case IntegrationType.SALESFORCE:
          result = await this.testSalesforceConnection(
            integration.credentials as any
          );
          break;
          
        case IntegrationType.HUBSPOT:
          result = await this.testHubspotConnection(
            integration.credentials as any
          );
          break;
          
        case IntegrationType.WEBHOOK:
          result = await this.testWebhook(integrationId);
          break;
          
        // Add more integration types as needed
          
        default:
          result = { success: false, message: `Testing not implemented for ${integration.type}` };
      }
      
      // Log test result
      await createEvent({
        eventType: result.success ? 'INTEGRATION_TEST_SUCCEEDED' : 'INTEGRATION_TEST_FAILED',
        resourceType: 'INTEGRATION',
        resourceId: integrationId,
        organizationId: integration.organizationId,
        severity: result.success ? EventSeverity.INFO : EventSeverity.WARNING,
        metadata: {
          type: integration.type,
          name: integration.name,
          result
        }
      });
      
      return result;
    } catch (error) {
      // Log error
      await createEvent({
        eventType: 'INTEGRATION_TEST_FAILED',
        resourceType: 'INTEGRATION',
        resourceId: integrationId,
        organizationId: integration.organizationId,
        severity: EventSeverity.ERROR,
        metadata: {
          type: integration.type,
          name: integration.name,
          error: (error as Error).message
        }
      });
      
      return {
        success: false,
        message: (error as Error).message
      };
    }
  }

  /**
   * Sync data with external system
   */
  static async syncWithExternalSystem(
    integrationId: string,
    eventType: IntegrationEventType,
    data: any
  ) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId }
    });
    
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }
    
    // Check if integration is enabled
    if (!integration.enabled) {
      return { success: false, message: 'Integration is disabled' };
    }
    
    // Check if this event type should be synced
    const settings = integration.settings as any;
    if (!settings.syncEvents.includes(eventType)) {
      return { success: false, message: `Event type ${eventType} is not configured for sync` };
    }
    
    try {
      let result: any;
      
      // Process based on integration type
      switch (integration.type) {
        case IntegrationType.SALESFORCE:
          result = await this.syncToSalesforce(
            integration,
            eventType,
            data
          );
          break;
          
        case IntegrationType.HUBSPOT:
          result = await this.syncToHubspot(
            integration,
            eventType,
            data
          );
          break;
          
        case IntegrationType.WEBHOOK:
          result = await this.sendWebhook(
            integration,
            eventType,
            data
          );
          break;
          
        // Add more integration types as needed
          
        default:
          result = { success: false, message: `Sync not implemented for ${integration.type}` };
      }
      
      // Log sync result
      await createEvent({
        eventType: result.success ? 'INTEGRATION_SYNC_SUCCEEDED' : 'INTEGRATION_SYNC_FAILED',
        resourceType: 'INTEGRATION',
        resourceId: integrationId,
        organizationId: integration.organizationId,
        severity: result.success ? EventSeverity.INFO : EventSeverity.WARNING,
        metadata: {
          type: integration.type,
          event: eventType,
          result
        }
      });
      
      return result;
    } catch (error) {
      // Log error
      await createEvent({
        eventType: 'INTEGRATION_SYNC_FAILED',
        resourceType: 'INTEGRATION',
        resourceId: integrationId,
        organizationId: integration.organizationId,
        severity: EventSeverity.ERROR,
        metadata: {
          type: integration.type,
          event: eventType,
          error: (error as Error).message
        }
      });
      
      return {
        success: false,
        message: (error as Error).message
      };
    }
  }

  /**
   * Register a webhook to send data to an external system
   */
  static async registerWebhook(
    organizationId: string,
    url: string,
    events: string[],
    secret?: string,
    description?: string
  ): Promise<Webhook> {
    // Validate URL
    if (!url || !url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS protocol');
    }
    
    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        organizationId,
        url,
        events,
        secret,
        description,
        active: true
      }
    });
    
    // Log event
    await createEvent({
      eventType: 'WEBHOOK_REGISTERED',
      resourceType: 'WEBHOOK',
      resourceId: webhook.id,
      organizationId,
      severity: EventSeverity.INFO,
      metadata: {
        url,
        events
      }
    });
    
    return webhook;
  }

  /**
   * Send data to a webhook
   */
  static async sendWebhook(
    integration: any,
    eventType: string,
    data: any
  ) {
    try {
      const settings = integration.settings as any;
      
      if (!settings.webhookUrl) {
        return { success: false, message: 'No webhook URL configured' };
      }
      
      // Prepare payload
      const payload: WebhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Generate signature if secret is provided
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (settings.webhookSecret) {
        const signature = this.generateSignature(
          JSON.stringify(payload),
          settings.webhookSecret
        );
        headers['X-Signature'] = signature;
      }
      
      // Send to webhook endpoint
      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Webhook request failed with status ${response.status}`);
      }
      
      return {
        success: true,
        statusCode: response.status
      };
    } catch (error) {
      console.error('Error sending webhook:', error);
      throw error;
    }
  }

  /**
   * Process incoming webhook data from external system
   */
  static async processIncomingWebhook(
    integrationId: string,
    payload: any,
    signature?: string
  ) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId }
    });
    
    if (!integration) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }
    
    // Verify signature if provided
    if (signature && integration.settings.webhookSecret) {
      const isValid = this.verifySignature(
        JSON.stringify(payload),
        signature,
        integration.settings.webhookSecret
      );
      
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }
    
    try {
      // Process based on integration type
      switch (integration.type) {
        case IntegrationType.SALESFORCE:
          // Handle Salesforce webhook
          break;
          
        case IntegrationType.HUBSPOT:
          // Handle HubSpot webhook
          break;
          
        // Add more cases as needed
      }
      
      // Log successful processing
      await createEvent({
        eventType: 'INCOMING_WEBHOOK_PROCESSED',
        resourceType: 'INTEGRATION',
        resourceId: integrationId,
        organizationId: integration.organizationId,
        severity: EventSeverity.INFO,
        metadata: {
          type: integration.type,
          payload
        }
      });
      
      return { success: true };
    } catch (error) {
      // Log error
      await createEvent({
        eventType: 'INCOMING_WEBHOOK_FAILED',
        resourceType: 'INTEGRATION',
        resourceId: integrationId,
        organizationId: integration.organizationId,
        severity: EventSeverity.ERROR,
        metadata: {
          type: integration.type,
          error: (error as Error).message
        }
      });
      
      throw error;
    }
  }

  /**
   * Generate a signature for outgoing webhook payloads
   */
  private static generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify signature from incoming webhook
   */
  private static verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Test Salesforce connection
   */
  private static async testSalesforceConnection(credentials: any) {
    // In a real implementation, this would connect to Salesforce API
    // For demonstration, just validate required credentials
    if (!credentials.accessToken || !credentials.instanceUrl) {
      return {
        success: false,
        message: 'Missing required Salesforce credentials'
      };
    }
    
    // Mock successful connection
    return {
      success: true,
      message: 'Successfully connected to Salesforce'
    };
  }

  /**
   * Test HubSpot connection
   */
  private static async testHubspotConnection(credentials: any) {
    // In a real implementation, this would connect to HubSpot API
    if (!credentials.apiKey && !credentials.accessToken) {
      return {
        success: false,
        message: 'Missing required HubSpot credentials'
      };
    }
    
    // Mock successful connection
    return {
      success: true,
      message: 'Successfully connected to HubSpot'
    };
  }

  /**
   * Test webhook by sending a test event
   */
  private static async testWebhook(integrationId: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { integrationId }
    });
    
    if (!webhook) {
      return {
        success: false,
        message: 'No webhook found for this integration'
      };
    }
    
    try {
      // Prepare test payload
      const payload = {
        event: 'TEST_EVENT',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook'
        }
      };
      
      // Generate signature if secret is provided
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (webhook.secret) {
        const signature = this.generateSignature(
          JSON.stringify(payload),
          webhook.secret
        );
        headers['X-Signature'] = signature;
      }
      
      // Send to webhook endpoint
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        return {
          success: false,
          message: `Webhook test failed with status ${response.status}`
        };
      }
      
      return {
        success: true,
        message: 'Webhook test successful',
        statusCode: response.status
      };
    } catch (error) {
      return {
        success: false,
        message: `Webhook test failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Sync data to Salesforce
   */
  private static async syncToSalesforce(
    integration: any,
    eventType: string,
    data: any
  ) {
    // In a real implementation, this would connect to Salesforce API
    // and perform the appropriate operation based on the event type
    
    // For demonstration, return mock success
    return {
      success: true,
      message: `Data synchronized to Salesforce for event ${eventType}`,
      externalId: `sf_${Date.now()}`
    };
  }

  /**
   * Sync data to HubSpot
   */
  private static async syncToHubspot(
    integration: any,
    eventType: string,
    data: any
  ) {
    // In a real implementation, this would connect to HubSpot API
    // and perform the appropriate operation based on the event type
    
    // For demonstration, return mock success
    return {
      success: true,
      message: `Data synchronized to HubSpot for event ${eventType}`,
      externalId: `hs_${Date.now()}`
    };
  }

  /**
   * Validate integration configuration
   */
  private static validateConfig(config: IntegrationConfig) {
    if (!config.type) {
      throw new Error('Integration type is required');
    }
    
    if (!config.name) {
      throw new Error('Integration name is required');
    }
    
    // Validate credentials based on type
    switch (config.type) {
      case IntegrationType.SALESFORCE:
        if (!config.credentials.accessToken || !config.credentials.instanceUrl) {
          throw new Error('Salesforce integration requires accessToken and instanceUrl');
        }
        break;
        
      case IntegrationType.HUBSPOT:
        if (!config.credentials.apiKey && !config.credentials.accessToken) {
          throw new Error('HubSpot integration requires either apiKey or accessToken');
        }
        break;
        
      case IntegrationType.WEBHOOK:
        if (!config.settings.webhookUrl) {
          throw new Error('Webhook integration requires webhookUrl');
        }
        break;
        
      // Add more validation for other integration types
    }
    
    // Validate settings
    if (!config.settings.syncEvents || !Array.isArray(config.settings.syncEvents)) {
      throw new Error('syncEvents must be an array of event types');
    }
    
    if (!config.settings.syncDirection) {
      throw new Error('syncDirection is required');
    }
  }

  /**
   * Validate settings for update
   */
  private static validateSettingsForUpdate(settings: any) {
    if (settings.syncEvents && !Array.isArray(settings.syncEvents)) {
      throw new Error('syncEvents must be an array of event types');
    }
    
    if (settings.syncDirection && 
        !['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'].includes(settings.syncDirection)) {
      throw new Error('syncDirection must be INBOUND, OUTBOUND, or BIDIRECTIONAL');
    }
  }

  /**
   * Get all integrations for an organization
   */
  static async getIntegrations(organizationId: string) {
    return prisma.integration.findMany({
      where: { organizationId }
    });
  }

  /**
   * Get a specific integration
   */
  static async getIntegration(integrationId: string) {
    return prisma.integration.findUnique({
      where: { id: integrationId }
    });
  }

  /**
   * Enable an integration
   */
  static async enableIntegration(integrationId: string) {
    return prisma.integration.update({
      where: { id: integrationId },
      data: { enabled: true }
    });
  }

  /**
   * Disable an integration
   */
  static async disableIntegration(integrationId: string) {
    return prisma.integration.update({
      where: { id: integrationId },
      data: { enabled: false }
    });
  }
} 