const { AppError, errorHandler } = require('../../../middleware/errorHandler');
const mongoose = require('mongoose');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('AppError Class', () => {
    it('should create an operational error with correct properties', () => {
      const message = 'Test error message';
      const statusCode = 400;
      const error = new AppError(message, statusCode);

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(statusCode);
      expect(error.status).toBe('fail'); // 4xx status codes result in 'fail'
      expect(error.isOperational).toBe(true);
      expect(error.message).toBe(message);
    });

    it('should set status to "error" for 5xx status codes', () => {
      const error = new AppError('Server error', 500);
      expect(error.status).toBe('error');
    });
  });

  describe('Error Handler Middleware', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle operational errors in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      const err = new AppError('Validation failed', 400);
      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'fail',
        message: 'Validation failed',
        error: err,
        stack: expect.any(String)
      }));
    });

    it('should handle operational errors in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      const err = new AppError('Invalid data', 400);
      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Invalid data'
      });
    });

    it('should handle non-operational errors in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      const err = new Error('Some programming error');
      err.statusCode = 500;
      err.status = 'error';
      
      // Mock console.error to prevent test output being cluttered
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      errorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Something went wrong'
      });
      
      console.error = originalConsoleError;
    });

    it('should handle mongoose validation errors', () => {
      process.env.NODE_ENV = 'production';
      
      const err = new mongoose.Error.ValidationError();
      err.errors = {
        field1: { message: 'Field1 is required' },
        field2: { message: 'Field2 must be valid' }
      };
      
      errorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain('Field1 is required');
      expect(res.json.mock.calls[0][0].message).toContain('Field2 must be valid');
    });

    it('should handle mongoose duplicate key errors', () => {
      process.env.NODE_ENV = 'production';
      
      const err = new Error('Duplicate key error');
      err.code = 11000;
      err.message = 'E11000 duplicate key error: { : "test@example.com" }';
      
      errorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain('Duplicate field value');
    });

    it('should handle mongoose cast errors', () => {
      process.env.NODE_ENV = 'production';
      
      const err = new mongoose.Error.CastError('ObjectId', '123', '_id');
      
      errorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain('Invalid _id');
    });
  });
}); 