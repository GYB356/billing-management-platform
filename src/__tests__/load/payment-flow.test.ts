import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  }
};

export default function() {
  const payload = {
    amount: 1000,
    currency: 'USD',
    paymentMethod: 'card'
  };

  const res = http.post('http://localhost:3000/api/payments', payload);
  
  check(res, {
    'is status 200': (r) => r.status === 200,
    'transaction succeeded': (r) => r.json().status === 'succeeded'
  });

  sleep(1);
}
