import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isAuthenticated, isAdmin } from '../../middleware/auth';

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  describe('isAuthenticated', () => {
    it('should pass valid JWT token', () => {
      const token = jwt.sign(
        { id: '123', email: 'test@example.com', role: 'user' },
        process.env.JWT_SECRET!
      );

      mockReq.headers = {
        authorization: `Bearer ${token}`
      };

      isAuthenticated(
        mockReq as Request,
        mockRes as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject missing token', () => {
      isAuthenticated(
        mockReq as Request,
        mockRes as Response,
        nextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No token provided'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };

      isAuthenticated(
        mockReq as Request,
        mockRes as Response,
        nextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('isAdmin', () => {
    it('should pass admin user', () => {
      mockReq.user = {
        id: '123',
        email: 'admin@example.com',
        role: 'admin'
      };

      isAdmin(
        mockReq as Request,
        mockRes as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', () => {
      mockReq.user = {
        id: '123',
        email: 'user@example.com',
        role: 'user'
      };

      isAdmin(
        mockReq as Request,
        mockRes as Response,
        nextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Admin access required'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated request', () => {
      isAdmin(
        mockReq as Request,
        mockRes as Response,
        nextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not authenticated'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
}); 