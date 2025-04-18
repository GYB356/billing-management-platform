/**
 * Async Handler Wrapper
 * Eliminates the need for try/catch blocks in route handlers
 * Automatically passes errors to the error handler middleware
 */

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler; 