/**
 * Common test setup and utilities
 */

// Import required modules
const request = require('supertest');
const app = require('../app');

// Sample test data for reuse across tests
const testData = {
  // User authentication
  validUser: {
    username: 'testuser',
    password: 'Password123!'
  },
  invalidUser: {
    username: 'nonexistent',
    password: 'wrong'
  },
  
  // Sample entities
  customer: {
    id: '60d21b4667d0d8992e610c85',
    name: 'Test Customer',
    email: 'customer@example.com',
    address: '123 Test St'
  },
  
  invoice: {
    id: '60d21b4667d0d8992e610c86',
    customerId: '60d21b4667d0d8992e610c85',
    amount: 100.00,
    dueDate: '2023-12-31',
    status: 'pending'
  },
  
  // Non-existent IDs for 404 tests
  nonExistentCustomerId: '60d21b4667d0d8992e610c99',
  nonExistentInvoiceId: '60d21b4667d0d8992e610c98'
};

/**
 * Helper function to get auth token for tests
 * @returns {Promise<string>} JWT token
 */
async function getAuthToken() {
  try {
    const res = await request(app)
      .post('/api/auth/login')
      .send(testData.validUser);
    
    return res.body.token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Helper function to create test resources before tests
 */
async function setupTestData() {
  // This would create necessary test data in a real application
  // For example, creating a test user, customer, etc.
}

/**
 * Helper function to clean up test resources after tests
 */
async function cleanupTestData() {
  // This would clean up test data in a real application
  // For example, deleting test users, customers, etc.
}

module.exports = {
  testData,
  getAuthToken,
  setupTestData,
  cleanupTestData,
  app,
  request
};
