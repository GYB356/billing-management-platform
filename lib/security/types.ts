export enum SecurityEventType {
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INVALID_TOKEN = 'INVALID_TOKEN'
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export interface SecurityAlert {
  id: string;
  eventType: SecurityEventType;
  severity: AlertSeverity;
  timestamp: Date;
  message: string;
  resolved: boolean;
  details?: Record<string, any>;
} 