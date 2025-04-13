# Advanced Billing System

## Features

### 1. Billing Rule Builder
- Visual rule builder with templates
- Customizable conditions and actions
- Support for multiple pricing models
- Real-time preview and validation

### 2. Payment Processing
- Stripe integration for card payments
- BitPay for cryptocurrency
- Wyre for alternative payments
- Webhook handlers for all processors

### 3. Analytics and Reporting
- Interactive metric dashboards
- Plan comparison tools
- Usage tracking
- Revenue analytics

### 4. Crypto & Alternative Payments
- Cryptocurrency support via BitPay integration
- Alternative payment methods via Wyre
- Stripe's crypto-compatible payment tools
- Complete webhook support for all payment types

### 5. Embedded Financial Services
- Buy Now Pay Later options through multiple providers
- Stripe Capital integration for business financing
- FinBox integration for flexible payment plans
- Rutter API support for unified financial services

### 6. Climate-Conscious Billing
- Carbon footprint tracking based on usage metrics
- Visualization of emissions by service category
- Optional carbon offsetting via Patch.io API
- Climate-impact reporting for businesses

## Getting Started

1. Install dependencies:
```bash
   npm install
   ```

2. Set up environment variables:
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# BitPay Configuration
BITPAY_API_KEY=...
BITPAY_WEBHOOK_SECRET=...

# Wyre Configuration
WYRE_API_KEY=...
WYRE_SECRET_KEY=...
WYRE_ACCOUNT_ID=...
WYRE_WEBHOOK_SECRET=...
```

3. Run the development server:
```bash
   npm run dev
   ```

## Usage

### Billing Rule Builder

```typescript
import RuleBuilder from '@/app/components/billing/RuleBuilder';

export default function BillingPage() {
  const handleRuleSave = (rule) => {
    // Handle the saved rule
    console.log('Saved rule:', rule);
  };

  return <RuleBuilder onSave={handleRuleSave} />;
}
```

### Billing Metrics

```typescript
import BillingMetrics from '@/app/components/billing/BillingMetrics';

const metrics = [
  {
    id: 'revenue',
    name: 'Monthly Revenue',
    value: 12500,
    unit: 'currency',
    trend: 15.5,
    history: [
      { date: '2024-01-01', value: 10000 },
      { date: '2024-02-01', value: 11200 },
      { date: '2024-03-01', value: 12500 }
    ]
  }
];

export default function DashboardPage() {
  return <BillingMetrics metrics={metrics} period="month" />;
}
```

### Plan Comparison

```typescript
import PlanComparison from '@/app/components/billing/PlanComparison';

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 29,
    interval: 'month',
    description: 'For small teams',
    features: [
      { name: 'Feature 1', included: true },
      { name: 'API Calls', included: '10,000' }
    ]
  }
];

export default function PricingPage() {
  return (
    <PlanComparison
      plans={plans}
      onSelectPlan={(planId) => console.log('Selected plan:', planId)}
    />
  );
}
```

## Testing

Run the test suite:
```bash
npm test
```

Key test files:
- `__tests__/billing/rule-builder.test.tsx`
- `__tests__/billing/billing-metrics.test.tsx`

## Webhook Endpoints

### Stripe Webhooks
- Endpoint: `/api/webhooks/stripe`
- Events: payment success/failure, subscription updates

### BitPay Webhooks
- Endpoint: `/api/webhooks/bitpay`
- Events: payment completion, confirmation, expiration

### Wyre Webhooks
- Endpoint: `/api/webhooks/wyre`
- Events: order status updates, transfer completion

## Security

1. **Webhook Verification**
   - All webhooks verify signatures
   - Rate limiting implemented
   - IP filtering recommended

2. **Payment Processing**
   - PCI compliance maintained
   - Sensitive data never logged
   - All transactions recorded

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License 