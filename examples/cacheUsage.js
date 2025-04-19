/**
 * Example demonstrating how to use Redis cache in API routes
 */
const express = require('express');
const router = express.Router();
const redisCache = require('../utils/redis-cache');
const Invoice = require('../models/invoice');
const User = require('../models/user');
const { asyncHandler } = require('../middleware/asyncHandler');

// Cache all invoices for 5 minutes (300 seconds)
router.get('/invoices', redisCache.middleware(300), asyncHandler(async (req, res) => {
  const invoices = await Invoice.find().populate('customer', 'name email');
  res.json({ success: true, data: invoices });
}));

// Cache individual invoice by ID for 10 minutes (600 seconds)
router.get('/invoices/:id', redisCache.middleware(600), asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('customer', 'name email');
  
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }
  
  res.json({ success: true, data: invoice });
}));

// Route to clear all invoice cache
router.post('/admin/clear-invoice-cache', asyncHandler(async (req, res) => {
  await redisCache.deletePattern('cache:/api/invoices*');
  res.json({ success: true, message: 'Invoice cache cleared' });
}));

// Using the cache programmatically
router.get('/users/dashboard-stats', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `user:${userId}:dashboard-stats`;
  
  // Try to get data from cache first
  let stats = await redisCache.get(cacheKey);
  
  if (!stats) {
    // If not in cache, perform expensive operation
    console.log('Cache miss - calculating dashboard stats');
    
    // Complex and expensive aggregation (simplified for example)
    stats = await User.aggregate([
      { $match: { _id: userId } },
      { $lookup: { from: 'invoices', localField: '_id', foreignField: 'user', as: 'invoices' } },
      { $lookup: { from: 'payments', localField: '_id', foreignField: 'user', as: 'payments' } },
      {
        $project: {
          totalInvoices: { $size: '$invoices' },
          totalPaid: { $sum: '$payments.amount' },
          // More complex calculations...
        }
      }
    ]);
    
    // Cache the result for 15 minutes (900 seconds)
    await redisCache.set(cacheKey, stats, 900);
  } else {
    console.log('Cache hit - using cached dashboard stats');
  }
  
  res.json({ success: true, data: stats });
}));

// Manually invalidate specific user cache when data changes
router.post('/users/:id/update', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  
  // Update user
  const updatedUser = await User.findByIdAndUpdate(userId, req.body, { new: true });
  
  // Invalidate user's cache
  await redisCache.deletePattern(`user:${userId}:*`);
  
  res.json({ success: true, data: updatedUser });
}));

// Get cache statistics (admin only)
router.get('/admin/cache-stats', asyncHandler(async (req, res) => {
  const stats = await redisCache.getStats();
  res.json({ success: true, data: stats });
}));

// Cache with different TTLs based on query parameters
router.get('/reports', asyncHandler(async (req, res, next) => {
  // Choose TTL based on report type
  let ttl = 3600; // Default 1 hour
  
  if (req.query.type === 'daily') {
    ttl = 3600; // 1 hour for daily reports
  } else if (req.query.type === 'weekly') {
    ttl = 86400; // 24 hours for weekly reports
  } else if (req.query.type === 'monthly') {
    ttl = 86400 * 7; // 7 days for monthly reports
  }
  
  // Apply cache middleware with dynamic TTL
  redisCache.middleware(ttl)(req, res, next);
}), asyncHandler(async (req, res) => {
  // Report generation logic
  const reports = await generateReports(req.query.type);
  res.json({ success: true, data: reports });
}));

// Helper function for report generation (simulated)
async function generateReports(type) {
  // Simulate complex report generation
  return { type, generatedAt: new Date(), data: {} };
}

module.exports = router; 