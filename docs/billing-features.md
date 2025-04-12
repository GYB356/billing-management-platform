# Billing System Documentation

## Overview

The billing system provides a comprehensive solution for managing payments, subscriptions, and usage-based billing. It includes features for creating custom billing rules, processing various payment methods, and analyzing billing metrics.

## Components

### 1. Billing Rule Builder

The Rule Builder allows creation of custom billing rules through a visual interface.

#### Available Templates

- **Bandwidth Pricing**
  - Regional pricing for data transfer
  - Conditions: bandwidth usage, region
  - Actions: usage-based charges

- **Time-Based Pricing**
  - Peak and off-peak rates
  - Conditions: usage minutes, time of day
  - Actions: time-sensitive charging

- **Event-Based Pricing**
  - Process-based charging
  - Conditions: event type, volume
  - Actions: event processing fees

- **Hybrid Subscription**
  - Base subscription + usage
  - Conditions: subscription status
  - Actions: base charges + usage components

#### Usage Example

```typescript
import { findTemplate } from '@/app/billing/features/rule-builder/templates';

const bandwidthTemplate = findTemplate('bandwidth-pricing');
const rule = {
  ...bandwidthTemplate,
  conditions: [
    { type: 'bandwidth', operator: 'gt', value: 1000 },
    { type: 'region', operator: 'eq', value: 'us-east' }
  ]
};
```

### 2. Payment Processing

#### Supported Payment Methods

1. **Stripe Integration**
   - Credit/debit cards
   - ACH payments
   - SEPA transfers
   - Crypto payments (TODO)

2. **BitPay Integration**
   - Bitcoin
   - Ethereum
   - Other supported cryptocurrencies

3. **Wyre Integration**
   - Bank transfers
   - International payments
   - Crypto-fiat conversions

#### Webhook Configuration

Each payment processor requires specific environment variables:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# BitPay
BITPAY_API_KEY=...
BITPAY_WEBHOOK_SECRET=...

# Wyre
WYRE_API_KEY=...
WYRE_WEBHOOK_SECRET=...
```

### 3. Analytics Components

#### BillingMetrics Component

Displays key billing metrics with interactive charts.

```typescript
import BillingMetrics from '@/app/components/billing/BillingMetrics';

const metrics = [
  {
    id: 'revenue',
    name: 'Monthly Revenue',
    value: 50000,
    trend: 12.5,
    history: [/* ... */]
  }
];

<BillingMetrics metrics={metrics} period="month" />
```

#### PlanComparison Component

Enables side-by-side comparison of billing plans.

```typescript
import PlanComparison from '@/app/components/billing/PlanComparison';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    features: [/* ... */]
  }
];

<PlanComparison plans={plans} onSelectPlan={handlePlanSelection} />
```

### 4. Embedded Financial Services (Coming Soon)

#### Buy Now, Pay Later (BNPL)
- Integration with Stripe Capital (Planned)
- Alternative providers:
  - FinBox integration
  - Rutter API support
- Features to include:
  - Instant eligibility checks
  - Flexible payment terms
  - Automated repayment scheduling
  - Risk assessment

### 5. Climate-Conscious Billing (Coming Soon)

#### Carbon Tracking
- Transaction-based carbon footprint calculation
- Monthly environmental impact reports
- Integration with Patch.io for:
  - Carbon offset purchasing
  - Verified carbon credit marketplace
  - Impact reporting

#### Sustainable Billing Options
- Optional carbon offset add-on
- Green payment method incentives
- Environmental impact dashboard

## Implementation Status

### Completed Features
- Basic payment processing (Stripe, BitPay, Wyre)
- Billing rule templates
- Analytics components
- Plan comparison tools

### In Progress
- Visual rule builder drag-and-drop interface
- Stripe crypto payment integration
- Webhook handling improvements

### Planned Features
- BNPL integrations
- Carbon tracking and offset system
- Enhanced crypto payment options

## Testing

Key test files and their purposes:

1. `__tests__/billing/rule-builder.test.tsx`
   - Template rendering
   - Condition customization
   - Action modification

2. `__tests__/billing/billing-metrics.test.tsx`
   - Metric display
   - Chart rendering
   - Period selection

## Security Considerations

1. **Payment Processing**
   - Never log complete card numbers
   - Store tokens instead of payment details
   - Implement retry logic for failed payments

2. **Webhook Security**
   - Always verify signatures
   - Implement rate limiting
   - Log all webhook events

3. **Billing Rules**
   - Validate all rule conditions
   - Set maximum limits for charges
   - Implement approval workflows for high-value rules

## Best Practices

1. **Billing Rules**
   - Start with templates
   - Test rules with sample data
   - Document custom rules
   - Set reasonable limits

2. **Payment Processing**
   - Handle retries gracefully
   - Implement idempotency
   - Monitor failed payments
   - Send payment notifications

3. **Analytics**
   - Regular metric updates
   - Data retention policies
   - Backup important metrics
   - Monitor unusual patterns