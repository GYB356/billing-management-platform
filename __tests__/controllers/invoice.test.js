const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const Invoice = require('../../models/invoice');
const User = require('../../models/user');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Invoice.deleteMany({});
  await User.deleteMany({});
});

describe('Invoice Controller', () => {
  let token;
  let user;

  beforeEach(async () => {
    // Create test user
    user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });

    // Get authentication token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    token = loginResponse.body.data.accessToken;
  });

  describe('GET /api/v1/invoices', () => {
    it('should get all invoices with pagination', async () => {
      // Create test invoices
      await Invoice.create([
        {
          invoiceNumber: 'INV-001',
          customer: mongoose.Types.ObjectId(),
          items: [{
            description: 'Test Item 1',
            quantity: 1,
            unitPrice: 100
          }],
          dueDate: new Date(),
          createdBy: user._id
        },
        {
          invoiceNumber: 'INV-002',
          customer: mongoose.Types.ObjectId(),
          items: [{
            description: 'Test Item 2',
            quantity: 2,
            unitPrice: 200
          }],
          dueDate: new Date(),
          createdBy: user._id
        }
      ]);

      const response = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.results).toBe(2);
      expect(response.body.data.invoices).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter invoices by status', async () => {
      // Create test invoices with different statuses
      await Invoice.create([
        {
          invoiceNumber: 'INV-001',
          customer: mongoose.Types.ObjectId(),
          items: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 100
          }],
          status: 'paid',
          dueDate: new Date(),
          createdBy: user._id
        },
        {
          invoiceNumber: 'INV-002',
          customer: mongoose.Types.ObjectId(),
          items: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 100
          }],
          status: 'pending',
          dueDate: new Date(),
          createdBy: user._id
        }
      ]);

      const response = await request(app)
        .get('/api/v1/invoices?status=paid')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.invoices).toHaveLength(1);
      expect(response.body.data.invoices[0].status).toBe('paid');
    });
  });

  describe('POST /api/v1/invoices', () => {
    it('should create a new invoice', async () => {
      const invoiceData = {
        customer: mongoose.Types.ObjectId(),
        items: [{
          description: 'Test Item',
          quantity: 1,
          unitPrice: 100
        }],
        dueDate: new Date()
      };

      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(invoiceData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.invoice).toMatchObject({
        customer: invoiceData.customer.toString(),
        items: [{
          description: 'Test Item',
          quantity: 1,
          unitPrice: 100
        }]
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('required');
    });
  });
});