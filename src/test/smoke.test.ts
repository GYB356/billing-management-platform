import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

describe('Smoke Tests', () => {
  it('should have homepage accessible', async () => {
    const response = await fetch(BASE_URL);
    expect(response.status).toBe(200);
  });

  it('should have authentication working', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
  });

  it('should have pricing page accessible', async () => {
    const response = await fetch(`${BASE_URL}/pricing`);
    expect(response.status).toBe(200);
  });

  it('should have Stripe integration working', async () => {
    const response = await fetch(`${BASE_URL}/api/subscription/prices`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.prices).toBeDefined();
    expect(Array.isArray(data.prices)).toBe(true);
  });

  it('should have database connection working', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.database).toBe('connected');
  });
}); 