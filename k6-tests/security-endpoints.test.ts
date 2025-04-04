import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users for 3 minutes
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 20 }, // Stay at 20 users for 3 minutes
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete within 500ms
    errors: ['rate<0.1'], // Error rate should be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || 'test-admin-token';

export function setup() {
  // Setup code (if needed)
  return {};
}

export default function (data) {
  // Test security report endpoints
  const reportResponse = http.get(`${BASE_URL}/api/admin/security/reports`, {
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  check(reportResponse, {
    'security report status is 200': (r) => r.status === 200,
    'security report has correct data': (r) => {
      const data = r.json();
      return data.period && 
             typeof data.totalEvents === 'number' &&
             typeof data.eventsByType === 'object' &&
             typeof data.eventsBySeverity === 'object';
    },
  }) || errorRate.add(1);

  // Test security events endpoint
  const eventsResponse = http.get(`${BASE_URL}/api/admin/security/events`, {
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  check(eventsResponse, {
    'security events status is 200': (r) => r.status === 200,
    'security events has correct data': (r) => {
      const data = r.json();
      return Array.isArray(data) && data.every(event => 
        event.id && 
        event.eventType && 
        event.severity
      );
    },
  }) || errorRate.add(1);

  // Test suspicious activity endpoint
  const suspiciousResponse = http.get(`${BASE_URL}/api/admin/security/suspicious`, {
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  check(suspiciousResponse, {
    'suspicious activity status is 200': (r) => r.status === 200,
    'suspicious activity has correct data': (r) => {
      const data = r.json();
      return Array.isArray(data) && data.every(activity => 
        activity.id && 
        activity.eventType === 'SUSPICIOUS_ACTIVITY' &&
        activity.severity
      );
    },
  }) || errorRate.add(1);

  sleep(1);
}

export function teardown(data) {
  // Cleanup code (if needed)
} 