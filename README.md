# Billing Platform

AI-powered billing platform with anomaly detection and automated reporting.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Environment Variables

Required environment variables:

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@example.com
ADMIN_EMAIL=admin@example.com

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/billing_platform"

# Security
JWT_SECRET=your-secure-jwt-secret
```

## API Documentation

API documentation is available at `http://localhost:3000/api-docs` when running the server.

### Key Endpoints

1. **Billing Assistant**
   ```http
   POST /api/billing/ask
   Authorization: Bearer <token>
   {
     "question": "How do I update my billing info?"
   }
   ```

2. **Metrics Collection**
   ```http
   POST /api/metrics/collect
   Authorization: Bearer <token>
   {
     "type": "cpu",
     "value": 85.5
   }
   ```

## Features

- AI-powered billing assistance
- Automated anomaly detection
- Weekly billing summaries
- Email notifications and alerts

## Development

1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations: `npx prisma migrate dev`
4. Start development server: `npm run dev`
5. Run tests: `npm test`

## Security Notes

- Keep all API keys and secrets secure
- Use environment variables for sensitive data
- Enable authentication for all endpoints
- Rotate secrets regularly 