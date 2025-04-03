# Tax Management Integration Guide

## Overview

This guide explains how to integrate the Tax Management system into your application. It covers the available APIs, data structures, and best practices for implementation.

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn package manager
- Access to the Tax Management API

### Installation

1. Install the required dependencies:

```bash
npm install @your-org/tax-management
# or
yarn add @your-org/tax-management
```

2. Configure your environment variables:

```env
TAX_API_URL=https://api.your-domain.com
TAX_API_KEY=your-api-key
```

## API Integration

### Tax Rate Management

```typescript
import { TaxRateClient } from '@your-org/tax-management';

const taxClient = new TaxRateClient({
  apiUrl: process.env.TAX_API_URL,
  apiKey: process.env.TAX_API_KEY,
});

// Create a tax rate
const newTaxRate = await taxClient.createTaxRate({
  name: 'VAT',
  rate: 20,
  description: 'Value Added Tax',
  isActive: true,
});

// Get all tax rates
const taxRates = await taxClient.getTaxRates();

// Update a tax rate
const updatedTaxRate = await taxClient.updateTaxRate('tax-rate-id', {
  rate: 21,
});

// Delete a tax rate
await taxClient.deleteTaxRate('tax-rate-id');
```

### Tax Calculation

```typescript
import { TaxCalculator } from '@your-org/tax-management';

const calculator = new TaxCalculator();

// Calculate tax for an invoice
const result = calculator.calculateTax({
  subtotal: 1000,
  taxRates: [
    {
      id: 'tax-rate-id',
      rate: 20,
      name: 'VAT',
    },
  ],
});

console.log(result);
// {
//   subtotal: 1000,
//   taxAmount: 200,
//   total: 1200,
//   taxDetails: [
//     {
//       rate: 20,
//       amount: 200,
//       name: 'VAT',
//     },
//   ],
// }
```

### Tax Reports

```typescript
import { TaxReportClient } from '@your-org/tax-management';

const reportClient = new TaxReportClient({
  apiUrl: process.env.TAX_API_URL,
  apiKey: process.env.TAX_API_KEY,
});

// Get tax report for a date range
const report = await reportClient.getTaxReport({
  from: '2024-01-01',
  to: '2024-12-31',
});

console.log(report);
// [
//   {
//     period: '2024-01',
//     totalRevenue: 50000,
//     totalTax: 10000,
//     taxByRate: {
//       'VAT': 10000,
//     },
//   },
// ]
```

## Data Structures

### Tax Rate

```typescript
interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Tax Calculation Result

```typescript
interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxDetails: {
    rate: number;
    amount: number;
    name: string;
  }[];
}
```

### Tax Report

```typescript
interface TaxReport {
  period: string;
  totalRevenue: number;
  totalTax: number;
  taxByRate: {
    [key: string]: number;
  };
}
```

## Error Handling

```typescript
try {
  const result = await taxClient.createTaxRate({
    name: 'VAT',
    rate: 20,
  });
} catch (error) {
  if (error instanceof TaxValidationError) {
    // Handle validation errors
    console.error('Validation error:', error.details);
  } else if (error instanceof TaxApiError) {
    // Handle API errors
    console.error('API error:', error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

1. **Caching**
   ```typescript
   // Cache tax rates for 1 hour
   const CACHE_TTL = 60 * 60 * 1000;
   let taxRatesCache: TaxRate[] | null = null;
   let lastFetch = 0;

   async function getTaxRatesWithCache() {
     const now = Date.now();
     if (!taxRatesCache || now - lastFetch > CACHE_TTL) {
       taxRatesCache = await taxClient.getTaxRates();
       lastFetch = now;
     }
     return taxRatesCache;
   }
   ```

2. **Rate Limiting**
   ```typescript
   // Implement rate limiting
   const rateLimiter = new RateLimiter({
     maxRequests: 100,
     windowMs: 60 * 1000,
   });

   async function makeApiRequest() {
     await rateLimiter.waitForSlot();
     return taxClient.getTaxRates();
   }
   ```

3. **Validation**
   ```typescript
   // Validate tax rate before creation
   function validateTaxRate(taxRate: Partial<TaxRate>) {
     const errors: string[] = [];
     
     if (!taxRate.name) {
       errors.push('Name is required');
     }
     
     if (typeof taxRate.rate !== 'number' || taxRate.rate < 0 || taxRate.rate > 100) {
       errors.push('Rate must be between 0 and 100');
     }
     
     return errors;
   }
   ```

## Testing

```typescript
import { TaxRateClient } from '@your-org/tax-management';

describe('TaxRateClient', () => {
  let client: TaxRateClient;

  beforeEach(() => {
    client = new TaxRateClient({
      apiUrl: 'http://test-api',
      apiKey: 'test-key',
    });
  });

  it('should create a tax rate', async () => {
    const taxRate = await client.createTaxRate({
      name: 'Test Tax',
      rate: 10,
    });

    expect(taxRate).toMatchObject({
      name: 'Test Tax',
      rate: 10,
      isActive: true,
    });
  });
});
```

## Security Considerations

1. **API Key Management**
   - Store API keys securely
   - Rotate keys regularly
   - Use environment variables

2. **Data Validation**
   - Validate all input data
   - Sanitize output data
   - Implement rate limiting

3. **Error Handling**
   - Log errors securely
   - Don't expose sensitive information
   - Implement retry mechanisms

## Support

For additional support:
1. Check the API documentation
2. Review the troubleshooting guide
3. Contact the development team 