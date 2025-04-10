import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/customer/subscriptions';

test('GET /api/customer/subscriptions returns subscriptions', async () => {
  const { req, res } = createMocks({
    method: 'GET',
  });

  await handler(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(JSON.parse(res._getData())).toBeInstanceOf(Array);
});