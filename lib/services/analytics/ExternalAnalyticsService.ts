import { Analytics } from '@segment/analytics-node';
import { Amplitude } from '@amplitude/analytics-node';
import { MixpanelClient } from 'mixpanel';

export class ExternalAnalyticsService {
  private static instance: ExternalAnalyticsService;
  private segment: Analytics;
  private amplitude: Amplitude;
  private mixpanel: MixpanelClient;

  private constructor() {
    // Initialize analytics services
    this.segment = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY! });
    this.amplitude = new Amplitude(process.env.AMPLITUDE_API_KEY!);
    this.mixpanel = MixpanelClient.init(process.env.MIXPANEL_TOKEN!);
  }

  static getInstance(): ExternalAnalyticsService {
    if (!ExternalAnalyticsService.instance) {
      ExternalAnalyticsService.instance = new ExternalAnalyticsService();
    }
    return ExternalAnalyticsService.instance;
  }

  async trackEvent(event: {
    name: string;
    userId: string;
    properties: any;
  }) {
    // Track event in all services
    await Promise.all([
      this.segment.track({
        event: event.name,
        userId: event.userId,
        properties: event.properties,
      }),
      this.amplitude.logEvent({
        event_type: event.name,
        user_id: event.userId,
        event_properties: event.properties,
      }),
      this.mixpanel.track(event.name, {
        distinct_id: event.userId,
        ...event.properties,
      }),
    ]);
  }

  async identifyUser(user: {
    id: string;
    traits: any;
  }) {
    // Identify user in all services
    await Promise.all([
      this.segment.identify({
        userId: user.id,
        traits: user.traits,
      }),
      this.amplitude.setUserId(user.id),
      this.amplitude.setUserProperties(user.traits),
      this.mixpanel.people.set(user.id, user.traits),
    ]);
  }

  async trackPageView(page: {
    userId: string;
    name: string;
    properties: any;
  }) {
    await this.segment.page({
      userId: page.userId,
      name: page.name,
      properties: page.properties,
    });
  }

  async trackRevenue(revenue: {
    userId: string;
    amount: number;
    properties: any;
  }) {
    await Promise.all([
      this.amplitude.logRevenueV2({
        user_id: revenue.userId,
        amount: revenue.amount,
        ...revenue.properties,
      }),
      this.mixpanel.people.track_charge(revenue.userId, revenue.amount, revenue.properties),
    ]);
  }

  async setUserGroups(data: {
    userId: string;
    groups: { [key: string]: string[] };
  }) {
    await Promise.all([
      this.amplitude.setUserProperties({
        groups: data.groups,
      }),
      ...Object.entries(data.groups).map(([groupType, groupValues]) =>
        this.mixpanel.set_group(groupType, groupValues)
      ),
    ]);
  }

  async flush() {
    await Promise.all([
      this.segment.flush(),
      this.amplitude.flush(),
    ]);
  }
}

export const externalAnalytics = ExternalAnalyticsService.getInstance();
