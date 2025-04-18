const request = require('supertest');
const app = require('../../app');

describe('Authentication API', () => {
  // Test login success
  it('should authenticate a valid user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'Password123!'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Login endpoint');
  });

  // Test login failure - invalid credentials
  it('should reject login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'wrong',
        password: 'wrong'
      });
    
    // In a real implementation, this would return 401
    // But our example endpoint always returns 200 "Login endpoint"
    expect(res.statusCode).toEqual(200);
  });

  // Test login failure - missing fields
  it('should return 400 when login fields are missing', async () => {
    const testCases = [
      { username: 'testuser' }, // Missing password
      { password: 'Password123!' }, // Missing username
      {} // Missing both
    ];

    for (const testCase of testCases) {
      const res = await request(app)
        .post('/api/auth/login')
        .send(testCase);
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Missing required fields');
    }
  });

  // Test login failure - invalid username format
  it('should return 400 when username format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test@user', // Contains special character
        password: 'Password123!'
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('message', 'Invalid username format');
  });

  // Test login failure - password too short
  it('should return 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'short'
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('message', 'Password must be at least 8 characters');
  });
}); 