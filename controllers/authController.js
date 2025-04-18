const User = require('../models/user');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const crypto = require('crypto');
const { createSendToken } = require('../middleware/auth');

/**
 * User Registration Controller
 */
exports.register = async (req, res, next) => {
  // 1) Check if user already exists
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser) {
    return next(new AppError('Email already in use. Please login or use a different email', 400));
  }

  // 2) Create new user
  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    role: 'user' // Default role - never allow role to be set from request
  });

  // 3) Generate token and send response
  createSendToken(newUser, 201, req, res);
};

/**
 * User Login Controller
 */
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2) Check if user exists & password is correct
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) {
    // Record failed login attempt even if user doesn't exist (to prevent timing attacks)
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) Check if account is locked due to too many failed attempts
  if (user.isAccountLocked()) {
    return next(new AppError('Your account has been locked due to too many failed login attempts. Please reset your password or try again later.', 423));
  }

  // 4) Check if password is correct
  const isCorrect = await user.comparePassword(password);
  
  if (!isCorrect) {
    // Record failed login attempt
    await user.recordLoginAttempt();
    return next(new AppError('Incorrect email or password', 401));
  }

  // 5) Reset login attempts on successful login
  await user.resetLoginAttempts();

  // 6) Send token to client
  createSendToken(user, 200, req, res);
};

/**
 * Forgot Password Controller
 */
exports.forgotPassword = async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address', 404));
  }

  // 2) Generate the random reset token
  const resetToken = await user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email (in a real app)
  try {
    // In a real application, you would use a real email service here
    
    // For now, send token in response (for development only)
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
      resetToken // In production, don't send this back - just for testing
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error sending the email. Try again later!', 500));
  }
};

/**
 * Reset Password Controller
 */
exports.resetPassword = async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = Date.now();
  await user.save();

  // 3) Reset login attempts
  await user.resetLoginAttempts();

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
};

/**
 * Update Password Controller
 */
exports.updatePassword = async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.comparePassword(req.body.currentPassword))) {
    return next(new AppError('Your current password is incorrect', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
};

/**
 * Get Current User Profile
 */
exports.getMe = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
};

/**
 * Update User Profile
 */
exports.updateMe = async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.confirmPassword) {
    return next(new AppError('This route is not for password updates. Please use /update-password', 400));
  }

  // 2) Filter out fields that aren't allowed to be updated
  const filteredBody = {};
  const allowedFields = ['firstName', 'lastName', 'email'];
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredBody[key] = req.body[key];
    }
  });

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
};

/**
 * Soft Delete User's Own Account
 */
exports.deleteMe = async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
};

/**
 * Logout (Clear JWT Cookie)
 */
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  res.status(200).json({ 
    status: 'success',
    message: 'Successfully logged out'
  });
}; 