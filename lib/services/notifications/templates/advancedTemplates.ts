import { NotificationTemplate } from '../types';

export const advancedNotificationTemplates: Record<string, NotificationTemplate> = {
  usageThresholdAlert: {
    id: 'usage-threshold-alert',
    name: 'Usage Threshold Alert',
    channels: ['email', 'slack', 'inApp'],
    templates: {
      email: {
        subject: '🚨 Usage Alert: {{featureName}} threshold reached',
        body: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Usage Threshold Alert</h2>
            <p>Your usage of {{featureName}} has reached {{percentage}}% of your plan limit.</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
              <p><strong>Current Usage:</strong> {{currentUsage}} {{unit}}</p>
              <p><strong>Plan Limit:</strong> {{planLimit}} {{unit}}</p>
              <p><strong>Billing Period:</strong> {{billingPeriodStart}} to {{billingPeriodEnd}}</p>
            </div>
            <div style="margin-top: 20px;">
              <a href="{{upgradeUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Upgrade Plan
              </a>
            </div>
          </div>
        `,
      },
      slack: {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 Usage Alert',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*{{featureName}}* usage has reached {{percentage}}% of plan limit',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: '*Current Usage:*\n{{currentUsage}} {{unit}}',
              },
              {
                type: 'mrkdwn',
                text: '*Plan Limit:*\n{{planLimit}} {{unit}}',
              },
            ],
          },
        ],
      },
      inApp: {
        title: 'Usage Alert: {{featureName}}',
        message: '{{percentage}}% of plan limit reached',
        action: {
          label: 'View Usage',
          url: '{{usageUrl}}',
        },
      },
    },
  },

  subscriptionRenewal: {
    id: 'subscription-renewal',
    name: 'Subscription Renewal',
    channels: ['email', 'slack', 'inApp'],
    templates: {
      email: {
        subject: '🔄 Your subscription will renew soon',
        body: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Subscription Renewal Notice</h2>
            <p>Your subscription for {{planName}} will renew on {{renewalDate}}.</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
              <p><strong>Plan:</strong> {{planName}}</p>
              <p><strong>Amount:</strong> {{amount}}</p>
              <p><strong>Renewal Date:</strong> {{renewalDate}}</p>
            </div>
            <div style="margin-top: 20px;">
              <a href="{{billingUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Review Billing
              </a>
            </div>
          </div>
        `,
      },
      slack: {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔄 Subscription Renewal',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Your {{planName}} subscription will renew on {{renewalDate}}',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: '*Amount:*\n{{amount}}',
              },
              {
                type: 'mrkdwn',
                text: '*Renewal Date:*\n{{renewalDate}}',
              },
            ],
          },
        ],
      },
      inApp: {
        title: 'Subscription Renewal',
        message: 'Your {{planName}} subscription renews on {{renewalDate}}',
        action: {
          label: 'Review Billing',
          url: '{{billingUrl}}',
        },
      },
    },
  },
};
