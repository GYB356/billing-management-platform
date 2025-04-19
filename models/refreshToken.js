const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user lookup
refreshTokenSchema.index({ user: 1 });

refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt;
};

// Clean up expired tokens
refreshTokenSchema.statics.removeExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken; 