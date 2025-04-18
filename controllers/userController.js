const User = require('../models/user');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get all users (Admin only)
 */
exports.getAllUsers = async (req, res) => {
  // Basic pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Query with filters
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(field => delete queryObj[field]);

  // Find users with filters (exclude password)
  const users = await User.find(queryObj)
    .skip(skip)
    .limit(limit)
    .select('-password');

  // Count total users for pagination
  const total = await User.countDocuments(queryObj);

  res.status(200).json({
    status: 'success',
    results: users.length,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
      resultsPerPage: limit
    },
    data: {
      users
    }
  });
};

/**
 * Get a specific user by ID (Admin only)
 */
exports.getUser = async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
};

/**
 * Create a new user (Admin only)
 */
exports.createUser = async (req, res, next) => {
  // Check if user with this email already exists
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  // Create new user
  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role || 'user'
  });

  // Remove password from output
  newUser.password = undefined;

  res.status(201).json({
    status: 'success',
    data: {
      user: newUser
    }
  });
};

/**
 * Update a user (Admin only)
 */
exports.updateUser = async (req, res, next) => {
  // Filter out fields that shouldn't be updated directly
  const filteredBody = { ...req.body };
  const restrictedFields = ['password', 'passwordChangedAt', 'loginAttempts', 'loginLockUntil'];
  restrictedFields.forEach(field => delete filteredBody[field]);

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    filteredBody,
    {
      new: true,
      runValidators: true
    }
  );

  if (!updatedUser) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
};

/**
 * Delete a user (Admin only)
 */
exports.deleteUser = async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
}; 