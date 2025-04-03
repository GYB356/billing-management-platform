/**
 * Common TypeScript type definitions
 */

// Event severity levels
export enum EventSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL"
}

// User preference for notification channels
export enum NotificationChannel {
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
  SMS = "SMS",
  PUSH = "PUSH"
}

// Event type definition
export interface Event {
  id: string;
  timestamp: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  severity: EventSeverity;
  metadata: Record<string, any>;
  userId?: string;
  organizationId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

// User notification preferences
export interface NotificationPreferences {
  email?: boolean;
  inApp?: boolean;
  sms?: boolean;
  push?: boolean;
  types?: {
    billing?: boolean;
    security?: boolean;
    promotions?: boolean;
    updates?: boolean;
  };
}

// User profile with notification preferences
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
  notificationPreferences?: NotificationPreferences;
}

// Subscription type
export interface Subscription {
  id: string;
  stripeId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  planId: string;
  organizationId: string;
  userId: string;
  planName?: string;
}

// Organization type
export interface Organization {
  id: string;
  name: string;
  stripeCustomerId?: string;
  subscription?: Subscription;
  users?: UserProfile[];
  notificationPreferences?: NotificationPreferences;
} 