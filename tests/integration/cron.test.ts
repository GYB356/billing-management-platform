import { test, expect } from 'vitest';
import { app } from 'next/server';

test('GET /api/cron', async () => {
  const response = await app.getRequestHandler()({
    method: 'GET',
    url: '/api/cron',
  } as any);

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toEqual({ message: 'Cron jobs executed' });
});