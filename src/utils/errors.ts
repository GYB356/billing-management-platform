export class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AlertError extends BaseError {
  public errors: Record<string, string>;
  
  constructor(message: string, errors: Record<string, string> = {}) {
    super(message);
    this.errors = errors;
  }
}

export class ValidationError extends BaseError {
  public errors: Record<string, string>;
  
  constructor(errors: Record<string, string>) {
    super('Validation failed');
    this.errors = errors;
  }
}

export class PaymentError extends BaseError {
  public code: string;
  public gatewayResponse: Record<string, any>;

  constructor(code: string, message: string, gatewayResponse: Record<string, any> = {}) {
    super(message);
    this.code = code;
    this.gatewayResponse = gatewayResponse;
  }
}

export class ResourceNotFoundError extends BaseError {
  constructor(resource: string, id: string) {
    super(`${resource} not found with id ${id}`);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Not authorized') {
    super(message);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string) {
    super(`Database error: ${message}`);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
} 