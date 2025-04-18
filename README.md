# Secure Express API

This project implements best security practices for a Node.js Express API, addressing common vulnerabilities and security concerns.

## Security Features Implemented

1. **Rate Limiting**
   - General API rate limiting (60 requests per minute)
   - Stricter authentication endpoint rate limiting (5 requests per 15 minutes)

2. **Input Validation and Sanitization**
   - Form data validation
   - Query parameter sanitization
   - MongoDB query sanitization to prevent NoSQL injection
   - XSS protection through input sanitization

3. **Error Handling**
   - Centralized error handling with consistent response format
   - Environment-aware error details (detailed in development, limited in production)
   - Proper categorization and handling of different error types
   - Structured logging for better debugging and monitoring

4. **Security Middleware**
   - Request size limiting to prevent DoS attacks
   - Security headers with Helmet
   - CORS protection
   - HTTP Parameter Pollution protection
   - MongoDB query sanitization

## Setup

### Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

3. Run the application:
   ```
   npm start
   ```

4. For development with auto-restart:
   ```
   npm run dev
   ```

### Docker Deployment

The application uses a multi-stage Docker build for improved security and efficiency:

1. Build the Docker image:
   ```
   npm run docker:build
   ```

2. Run the container:
   ```
   npm run docker:run
   ```

3. Alternatively, use Docker Compose:
   ```
   docker-compose up -d
   ```

### Docker Security Features

- Multi-stage build to reduce image size and attack surface
- Non-root user for running the application
- Production-optimized Alpine-based image
- Environment variable handling best practices
- Docker health checks implemented

## Error Handling

The application implements a robust error handling system:

### Centralized Error Handler

All errors pass through a single global error handler middleware that:
- Formats error responses consistently
- Categorizes errors by type (validation, authentication, etc.)
- Provides appropriate HTTP status codes
- Limits sensitive information in production

### Error Types Handled

- **Validation Errors**: Missing or invalid fields
- **Authentication Errors**: Invalid or expired tokens
- **Database Errors**: Duplicate keys, invalid IDs, etc.
- **File Upload Errors**: Size limits, unexpected files
- **Custom Application Errors**: Business logic violations
- **Uncaught Exceptions**: Server-side errors

### Error Response Format

All error responses follow this structure:
```json
{
  "success": false,
  "error": "Human readable error message",
  "errorCode": "ERROR_CODE"
}
```

In development mode, additional information is included:
```json
{
  "success": false,
  "error": "Human readable error message",
  "errorCode": "ERROR_CODE",
  "stack": "Error stack trace"
}
```

### Async Error Handling

Routes use a wrapper function to catch async errors without try/catch blocks:
```javascript
// Before
app.get('/route', async (req, res, next) => {
  try {
    // Logic
  } catch (error) {
    next(error);
  }
});

// After
app.get('/route', asyncHandler(async (req, res) => {
  // Logic - errors automatically caught and passed to error handler
}));
```

## Testing

The application includes comprehensive test coverage across different levels:

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run only integration tests
npm run test:integration
```

### Test Structure

- **Unit Tests**: Test individual functions and utilities
  - Security utilities (sanitization, validation)
  - Rate limiter configuration

- **Integration Tests**: Test API endpoints and their interactions
  - Authentication endpoints
  - Invoice creation, retrieval, and payment processing
  - Error handling and validation

- **End-to-End Tests**: Test complete user flows
  - User authentication flow
  - Invoice creation and payment workflow

### Test Coverage

Tests have been designed to cover:
- Happy path scenarios
- Error handling and edge cases
- Security validation
- Authorization checks
- Data validation rules

## Environment Variables

The application uses a configuration system that loads from `.env` files in development and expects environment variables in production:

- `NODE_ENV` - Set to 'production' in production environments
- `PORT` - Application port (default: 3000)
- `RATE_LIMIT_WINDOW_MS` - General rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS` - Maximum requests per window
- `AUTH_RATE_LIMIT_WINDOW_MS` - Auth rate limit window in milliseconds
- `AUTH_RATE_LIMIT_MAX_REQUESTS` - Maximum auth requests per window

See `.env.example` for all available configuration options.

## Security Best Practices

- Keep all dependencies updated
- Use HTTPS in production
- Implement proper authentication (JWT, OAuth, etc.)
- Set appropriate CORS policies
- Add Content Security Policy headers
- Consider adding CSRF protection for cookie-based authentication
- Implement proper logging and monitoring
- Regular security audits and penetration testing 