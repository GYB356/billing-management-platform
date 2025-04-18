const request = require('supertest');
const app = require('../../app');

// Get auth token for testing
async function getAuthToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'testuser',
      password: 'Password123!'
    });
    
  return res.body.token;
}

// Mock customer ID from test data
const validCustomerId = '60d21b4667d0d8992e610c85';
const nonExistentCustomerId = '60d21b4667d0d8992e610c99';

describe('Invoice API', () => {
  let token;
  let createdInvoiceId;

  // Get auth token before tests
  beforeAll(async () => {
    token = await getAuthToken();
  });

  // Test successful invoice creation
  it('should create a new invoice', async () => {
    const mockInvoice = {
      customerId: validCustomerId,
      amount: 100,
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0] // 30 days in the future
    };

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(mockInvoice);
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.customerId).toEqual(mockInvoice.customerId);
    expect(res.body.amount).toEqual(mockInvoice.amount);
    expect(res.body.dueDate).toEqual(mockInvoice.dueDate);
    expect(res.body.status).toEqual('pending');

    // Save ID for later tests
    createdInvoiceId = res.body.id;
  });
  
  // Test missing required fields
  it('should return 400 when creating invoice with missing fields', async () => {
    const testCases = [
      {}, // All fields missing
      { customerId: validCustomerId }, // Missing amount and dueDate
      { amount: 100 }, // Missing customerId and dueDate
      { dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0] }, // Missing customerId and amount
      { customerId: validCustomerId, amount: 100 }, // Missing dueDate
      { customerId: validCustomerId, dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0] }, // Missing amount
      { amount: 100, dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0] } // Missing customerId
    ];

    for (const testCase of testCases) {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(testCase);
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message');
    }
  });
  
  // Test non-existent customer
  it('should return 404 when customer does not exist', async () => {
    const mockInvoice = {
      customerId: nonExistentCustomerId,
      amount: 100,
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
    };

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(mockInvoice);
    
    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toContain('Customer not found');
  });
  
  // Test invalid invoice data
  it('should return 400 when invoice data is invalid', async () => {
    const invalidInvoices = [
      {
        customerId: validCustomerId,
        amount: -100, // Negative amount
        dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
      },
      {
        customerId: validCustomerId,
        amount: 'not-a-number', // Invalid amount format
        dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
      },
      {
        customerId: validCustomerId,
        amount: 100,
        dueDate: 'invalid-date' // Invalid date format
      },
      {
        customerId: validCustomerId,
        amount: 100,
        dueDate: '2020-01-01' // Past date
      }
    ];

    for (const invalidInvoice of invalidInvoices) {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidInvoice);
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message');
    }
  });
  
  // Test unauthorized access
  it('should return 401 when accessing without authentication', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send({
        customerId: validCustomerId,
        amount: 100,
        dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('message', 'Unauthorized');
  });

  // Test retrieving an invoice by ID
  it('should get an invoice by ID', async () => {
    if (!createdInvoiceId) {
      console.warn('No invoice created in previous test, skipping');
      return;
    }

    const res = await request(app)
      .get(`/api/invoices/${createdInvoiceId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', createdInvoiceId);
    expect(res.body).toHaveProperty('status', 'pending');
  });

  // Test processing a payment
  it('should process payment for an invoice', async () => {
    if (!createdInvoiceId) {
      console.warn('No invoice created in previous test, skipping');
      return;
    }

    const paymentData = {
      amount: 100,
      method: 'credit_card',
      cardDetails: {
        number: '4242424242424242',
        expMonth: 12,
        expYear: 2025,
        cvc: '123'
      }
    };

    const res = await request(app)
      .post(`/api/invoices/${createdInvoiceId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send(paymentData);
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('status', 'success');
    expect(res.body).toHaveProperty('invoiceId', createdInvoiceId);
  });

  // Verify invoice status after payment
  it('should update invoice status to paid after payment', async () => {
    if (!createdInvoiceId) {
      console.warn('No invoice created in previous test, skipping');
      return;
    }

    const res = await request(app)
      .get(`/api/invoices/${createdInvoiceId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', createdInvoiceId);
    expect(res.body).toHaveProperty('status', 'paid');
  });
}); 