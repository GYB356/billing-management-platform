/**
 * Webhook Idempotency Test
 * 
 * This script tests that our Stripe webhook handler correctly processes
 * events only once and handles duplicate events appropriately.
 * 
 * Run with: node tests/webhook-idempotency.test.js
 */
const fetch = require('node-fetch');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const WEBHOOK_URL = 'http://localhost:3000/api/webhook/stripe'; // Update if different

// Helper to generate a signed payload (basic implementation)
function generateSignedPayload(payload, secret = 'whsec_test') {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  
  return {
    payload: payloadString,
    signature: `t=${timestamp},v1=${signature}`
  };
}

// Create a mock subscription event
function createMockSubscriptionEvent(overrides = {}) {
  return {
    id: `evt_${uuidv4().replace(/-/g, '')}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `sub_${uuidv4().replace(/-/g, '')}`,
        object: 'subscription',
        status: 'active',
        customer: 'cus_mock',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [
            {
              price: {
                id: 'price_mock'
              }
            }
          ]
        },
        metadata: {}
      }
    },
    type: 'customer.subscription.updated',
    livemode: false,
    ...overrides
  };
}

// Main test function
async function runTests() {
  console.log('🧪 Starting webhook idempotency tests');
  
  // Before running tests, make sure test data is clean
  await prisma.processedWebhookEvent.deleteMany({
    where: { eventId: { startsWith: 'evt_test' } }
  });
  
  // Test 1: Process new event
  const testEvent1 = createMockSubscriptionEvent({
    id: 'evt_test_idempotency_1'
  });
  
  console.log('\n📋 Test 1: Processing new event');
  
  const { payload: payload1, signature: signature1 } = generateSignedPayload(testEvent1);
  
  const response1 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature1
    },
    body: payload1
  });
  
  const result1 = await response1.json();
  console.log(`Status: ${response1.status}`, result1);
  
  // Verify the event was recorded in database
  const recordedEvent1 = await prisma.processedWebhookEvent.findUnique({
    where: { eventId: testEvent1.id }
  });
  
  console.log(`Event recorded in database: ${!!recordedEvent1}`);
  
  // Test 2: Try to process the same event again
  console.log('\n📋 Test 2: Processing duplicate event');
  
  const response2 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature1
    },
    body: payload1
  });
  
  const result2 = await response2.json();
  console.log(`Status: ${response2.status}`, result2);
  
  // Verify event wasn't processed twice (check events table or logs)
  console.log('Verify the event has status "duplicate" in the response');
  
  // Test 3: Test with data error
  console.log('\n📋 Test 3: Testing event with data error');
  
  const testEvent3 = createMockSubscriptionEvent({
    id: 'evt_test_idempotency_3',
    data: {
      object: {
        id: 'sub_invalid',
        object: 'subscription',
        customer: 'cus_nonexistent', // This should cause a data error
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [
            {
              price: {
                id: 'price_nonexistent' // This will cause a data error
              }
            }
          ]
        }
      }
    }
  });
  
  const { payload: payload3, signature: signature3 } = generateSignedPayload(testEvent3);
  
  const response3 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature3
    },
    body: payload3
  });
  
  const result3 = await response3.json();
  console.log(`Status: ${response3.status}`, result3);
  
  // Verify the event was recorded despite the data error
  const recordedEvent3 = await prisma.processedWebhookEvent.findUnique({
    where: { eventId: testEvent3.id }
  });
  
  console.log(`Data error event recorded to prevent retries: ${!!recordedEvent3}`);
  
  console.log('\n✅ Tests completed');
  await prisma.$disconnect();
}

// Run the tests
runTests().catch(e => {
  console.error('Test error:', e);
  prisma.$disconnect();
  process.exit(1);
}); 