# Tax Management API Documentation

## Overview

The Tax Management API provides endpoints for managing tax rates and calculating taxes for invoices. This documentation covers all available endpoints and their usage.

## Authentication

All API endpoints require authentication using a Bearer token. Include the token in the Authorization header:

```http
Authorization: Bearer <your-token>
```

## Endpoints

### Tax Rates

#### List Tax Rates

```http
GET /api/tax-rates
```

Returns a list of all tax rates.

**Response**
```json
[
  {
    "id": "string",
    "name": "string",
    "rate": number,
    "description": "string",
    "isActive": boolean,
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

#### Get Tax Rate

```http
GET /api/tax-rates/{id}
```

Returns a specific tax rate by ID.

**Response**
```json
{
  "id": "string",
  "name": "string",
  "rate": number,
  "description": "string",
  "isActive": boolean,
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### Create Tax Rate

```http
POST /api/tax-rates
```

Creates a new tax rate.

**Request Body**
```json
{
  "name": "string",
  "rate": number,
  "description": "string",
  "isActive": boolean
}
```

**Response**
```json
{
  "id": "string",
  "name": "string",
  "rate": number,
  "description": "string",
  "isActive": boolean,
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### Update Tax Rate

```http
PUT /api/tax-rates/{id}
```

Updates an existing tax rate.

**Request Body**
```json
{
  "name": "string",
  "rate": number,
  "description": "string",
  "isActive": boolean
}
```

**Response**
```json
{
  "id": "string",
  "name": "string",
  "rate": number,
  "description": "string",
  "isActive": boolean,
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### Delete Tax Rate

```http
DELETE /api/tax-rates/{id}
```

Deletes a tax rate.

**Response**
```json
{
  "success": true
}
```

### Tax Reports

#### Get Tax Report

```http
GET /api/tax/reports
```

Returns tax report data for a specified date range.

**Query Parameters**
- `from`: Start date (ISO format)
- `to`: End date (ISO format)

**Response**
```json
[
  {
    "period": "string",
    "totalRevenue": number,
    "totalTax": number,
    "taxByRate": {
      "string": number
    }
  }
]
```

## Error Responses

All endpoints may return the following error responses:

```json
{
  "error": "string",
  "details": object
}
```

Common HTTP status codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting

API requests are limited to 100 requests per minute per user. The response headers include:
- `X-RateLimit-Limit`: Maximum number of requests per minute
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Time when the rate limit window resets 