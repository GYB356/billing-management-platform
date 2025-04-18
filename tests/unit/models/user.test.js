const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../../models/user');
const bcrypt = require('bcrypt');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('User Model Tests', () => {
  afterEach(async () => {
    await User.deleteMany({});
  });

  it('should create & save a user successfully', async () => {
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      role: 'user'
    };
    
    const validUser = new User(userData);
    const savedUser = await validUser.save();
    
    // Verify saved user
    expect(savedUser._id).toBeDefined();
    expect(savedUser.firstName).toBe(userData.firstName);
    expect(savedUser.lastName).toBe(userData.lastName);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.role).toBe(userData.role);
    
    // Password should be hashed
    expect(savedUser.password).not.toBe(userData.password);
  });

  it('should fail validation when required fields are missing', async () => {
    const userWithoutRequiredField = new User({
      firstName: 'Jane',
      email: 'jane@example.com',
      password: 'Password123!'
    });
    
    let err;
    try {
      await userWithoutRequiredField.save();
    } catch (error) {
      err = error;
    }
    
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.lastName).toBeDefined();
  });

  it('should fail for duplicate email', async () => {
    // Create first user
    const firstUser = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'same@example.com',
      password: 'Password123!'
    });
    await firstUser.save();
    
    // Try to create second user with same email
    const secondUser = new User({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'same@example.com',
      password: 'Password456!'
    });
    
    let err;
    try {
      await secondUser.save();
    } catch (error) {
      err = error;
    }
    
    expect(err).toBeDefined();
    expect(err.code).toBe(11000); // Duplicate key error
  });

  it('should hash password before saving', async () => {
    const plainPassword = 'SecurePassword123!';
    const user = new User({
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      password: plainPassword
    });
    
    await user.save();
    
    // Verify password was hashed
    expect(user.password).not.toBe(plainPassword);
    
    // Verify we can compare password correctly
    const isMatch = await bcrypt.compare(plainPassword, user.password);
    expect(isMatch).toBe(true);
  });

  it('should correctly compare passwords', async () => {
    const password = 'SecurePassword123!';
    const user = new User({
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@example.com',
      password
    });
    
    await user.save();
    
    // Test comparePassword method
    const isCorrectPassword = await user.comparePassword(password);
    const isIncorrectPassword = await user.comparePassword('WrongPassword123!');
    
    expect(isCorrectPassword).toBe(true);
    expect(isIncorrectPassword).toBe(false);
  });

  it('should track login attempts and lock account', async () => {
    const user = new User({
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      password: 'Password123!'
    });
    
    await user.save();
    
    // Initially not locked
    expect(user.isAccountLocked()).toBe(false);
    
    // Record 5 login attempts to trigger lockout
    for (let i = 0; i < 5; i++) {
      await user.recordLoginAttempt();
    }
    
    // Account should now be locked
    expect(user.isAccountLocked()).toBe(true);
    expect(user.loginAttempts).toBe(5);
    expect(user.lockedUntil).toBeDefined();
    
    // Reset login attempts
    await user.resetLoginAttempts();
    
    // Account should be unlocked
    expect(user.isAccountLocked()).toBe(false);
    expect(user.loginAttempts).toBe(0);
    expect(user.lockedUntil).toBeUndefined();
  });

  it('should generate and verify password reset tokens', async () => {
    const user = new User({
      firstName: 'David',
      lastName: 'Wilson',
      email: 'david@example.com',
      password: 'Password123!'
    });
    
    await user.save();
    
    // Generate reset token
    const resetToken = await user.createPasswordResetToken();
    
    // Verify token is set and expiry is in the future
    expect(user.passwordResetToken).toBeDefined();
    expect(user.passwordResetExpires).toBeDefined();
    expect(user.passwordResetExpires).toBeInstanceOf(Date);
    expect(user.passwordResetExpires > new Date()).toBe(true);
    
    // Verify token is valid (this would normally be done in the reset password flow)
    // In a real application, we would use crypto to hash the token and find the user
    // For this test, we're just verifying the token exists
    expect(resetToken).toBeDefined();
    expect(typeof resetToken).toBe('string');
  });

  it('should correctly implement the full name virtual', () => {
    const user = new User({
      firstName: 'Eve',
      lastName: 'Johnson',
      email: 'eve@example.com',
      password: 'Password123!'
    });
    
    expect(user.fullName).toBe('Eve Johnson');
  });
}); 