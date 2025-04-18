const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');
const crypto = require('crypto');

/**
 * User Schema
 * Represents application users with secure password storage and role-based access
 */
const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in query results by default
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'manager'],
    default: 'user'
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false // Hide active status by default
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: false, updatedAt: true },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for frequently queried fields
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });

// Password hashing middleware
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();

  try {
    // Generate a salt with cost factor 12
    const salt = await bcrypt.genSalt(12);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Query middleware to exclude inactive users by default
UserSchema.pre(/^find/, function(next) {
  // "this" is the current query
  this.find({ active: { $ne: false } });
  next();
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if account is locked
UserSchema.methods.isAccountLocked = function() {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

// Instance method to increment login attempts
UserSchema.methods.recordLoginAttempt = async function() {
  this.loginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts >= 5 && !this.isAccountLocked()) {
    // Lock for 15 minutes
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  return this.save();
};

// Instance method to reset login attempts
UserSchema.methods.resetLoginAttempts = function() {
  this.loginAttempts = 0;
  this.lockedUntil = undefined;
  this.lastLogin = Date.now();
  return this.save();
};

// Static method to find by email (case insensitive)
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Method to generate password reset token
UserSchema.methods.createPasswordResetToken = async function() {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash the token and store in the database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  // Token expires in 1 hour
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  
  await this.save({ validateBeforeSave: false });
  
  return resetToken;
};

// Soft delete method
UserSchema.methods.softDelete = function() {
  this.active = false;
  return this.save({ validateBeforeSave: false });
};

const User = mongoose.model('User', UserSchema);

module.exports = User; 