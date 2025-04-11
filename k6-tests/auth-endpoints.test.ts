import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 5 }, // Ramp up to 5 users
    { duration: '3m', target: 5 }, // Stay at 5 users for 3 minutes
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users for 3 minutes
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should complete within 1s
    errors: ['rate<0.1'], // Error rate should be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'Test123!' },
  { email: 'test2@example.com', password: 'Test123!' },
  { email: 'test3@example.com', password: 'Test123!' },
];

export function setup() {
  // Setup code (if needed)
  return { testUsers };
}

export default function (data) {
  const user = data.testUsers[Math.floor(Math.random() * data.testUsers.length)];

  // Test login endpoint
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => {
      const data = r.json();
      return data.token && data.user;
    },
  }) || errorRate.add(1);

  // Test registration endpoint (with a small probability)
  if (Math.random() < 0.1) { // 10% chance to test registration
    const newUser = {
      email: `test${Date.now()}@example.com`,
      password: 'Test123!',
      name: 'Test User',
    };

    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(newUser), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    check(registerResponse, {
      'registration status is 201': (r) => r.status === 201,
      'registration response has user': (r) => {
        const data = r.json();
        return data.user && data.user.email === newUser.email;
      },
    }) || errorRate.add(1);
  }

  // Test password reset request (with a small probability)
  if (Math.random() < 0.05) { // 5% chance to test password reset
    const resetResponse = http.post(`${BASE_URL}/api/auth/password/reset`, JSON.stringify({
      email: user.email,
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    check(resetResponse, {
      'password reset status is 204': (r) => r.status === 204,
    }) || errorRate.add(1);
  }

  sleep(2);
}

export function teardown(data) {
  // Cleanup code (if needed)
} 