export type NotificationChannel = 'email' | 'webhook' | 'inApp' | 'sms' | 'push';

export interface Recipient {
  id: string;
  email: string;
  phone?: string;
  pushToken?: string;
}

export interface Notification {
  type: string;
  recipient: Recipient;
  data: Record<string, any>;
  channels: NotificationChannel[];
}

export interface NotificationTemplate {
  id: string;
  type: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  variables: string[];
}
