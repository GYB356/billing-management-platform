const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes below require authentication
router.use(protect);

// Admin only routes
router.route('/')
  .get(
    restrictTo('admin'), 
    asyncHandler(userController.getAllUsers)
  )
  .post(
    restrictTo('admin'), 
    asyncHandler(userController.createUser)
  );

router.route('/:id')
  .get(
    restrictTo('admin'), 
    asyncHandler(userController.getUser)
  )
  .patch(
    restrictTo('admin'), 
    asyncHandler(userController.updateUser)
  )
  .delete(
    restrictTo('admin'), 
    asyncHandler(userController.deleteUser)
  );

module.exports = router; 