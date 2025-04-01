/**
 * Script to run webhook tests with proper environment setup
 * 
 * This sets up the necessary environment variables for webhook tests
 * and then runs the tests.
 */

// Set the test webhook secret for local testing
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

// Import and run the tests
require('../tests/webhook-idempotency.test.js');

console.log('🚀 Webhook tests runner initialized'); 