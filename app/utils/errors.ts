export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    
    constructor(message: string, statusCode: number, isOperational: boolean = true) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      Object.setPrototypeOf(this, new.target.prototype);
      Error.captureStackTrace(this);
    }
  }
  
  export class PaymentError extends AppError {
    public readonly code: string;
    public readonly gatewayResponse?: any;
    
    constructor(message: string, code: string, gatewayResponse?: any, statusCode: number = 400) {
      super(message, statusCode);
      this.code = code;
      this.gatewayResponse = gatewayResponse;
    }
  }
  
  export class ResourceNotFoundError extends AppError {
    constructor(resource: string, id: string) {
      super(`${resource} not found with id ${id}`, 404);
    }
  }
  
  export class ValidationError extends AppError {
    public readonly errors: Record<string, string>;
    
    constructor(message: string, errors: Record<string, string>) {
      super(message, 400);
      this.errors = errors;
    }
  }
  
  export class AuthorizationError extends AppError {
    constructor(message: string = 'Not authorized') {
      super(message, 403);
    }
  }
  
  export class AuthorizationError extends AppError {
    constructor(message: string = 'Not authorized') {
      super(message, 403);
    }
  }