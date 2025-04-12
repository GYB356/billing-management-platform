export interface BillingRuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'usage' | 'subscription' | 'metered' | 'tiered' | 'volume';
  template: BillingRule;
}

export interface BillingRule {
  type: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  metadata: Record<string, any>;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'between' | 'contains';
  value: any;
}

export interface RuleAction {
  type: 'charge' | 'discount' | 'notify' | 'limit';
  params: Record<string, any>;
}

export const defaultTemplates: BillingRuleTemplate[] = [
  {
    id: 'usage-based',
    name: 'Usage-Based Pricing',
    description: 'Charge based on actual usage with configurable tiers',
    category: 'usage',
    template: {
      type: 'usage_based',
      conditions: [
        {
          field: 'usage_quantity',
          operator: 'greater_than',
          value: 0
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            unit_amount: 0.01,
            currency: 'usd',
            description: 'Usage charge'
          }
        }
      ],
      metadata: {
        tiers: [
          { up_to: 1000, unit_amount: 0.01 },
          { up_to: 10000, unit_amount: 0.008 },
          { up_to: 100000, unit_amount: 0.005 },
          { up_to: null, unit_amount: 0.003 }
        ]
      }
    }
  },
  {
    id: 'subscription-tiered',
    name: 'Tiered Subscription',
    description: 'Fixed monthly fee with usage tiers',
    category: 'tiered',
    template: {
      type: 'subscription_tiered',
      conditions: [
        {
          field: 'subscription_status',
          operator: 'equals',
          value: 'active'
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            base_amount: 49.99,
            currency: 'usd',
            interval: 'month',
            description: 'Monthly subscription'
          }
        }
      ],
      metadata: {
        features: {
          basic: ['Feature 1', 'Feature 2'],
          pro: ['Feature 1', 'Feature 2', 'Feature 3'],
          enterprise: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4']
        }
      }
    }
  },
  {
    id: 'metered-api',
    name: 'Metered API Usage',
    description: 'Pay-as-you-go API pricing with volume discounts',
    category: 'metered',
    template: {
      type: 'metered_api',
      conditions: [
        {
          field: 'api_calls',
          operator: 'greater_than',
          value: 0
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            currency: 'usd',
            description: 'API usage charge'
          }
        }
      ],
      metadata: {
        tiers: [
          { up_to: 10000, unit_amount: 0.001 },    // $0.001 per call up to 10k
          { up_to: 100000, unit_amount: 0.0008 },  // $0.0008 per call up to 100k
          { up_to: 1000000, unit_amount: 0.0005 }, // $0.0005 per call up to 1M
          { up_to: null, unit_amount: 0.0003 }     // $0.0003 per call above 1M
        ]
      }
    }
  },
  {
    id: 'storage-based',
    name: 'Storage-Based Pricing',
    description: 'Charge based on storage usage with monthly minimum',
    category: 'usage',
    template: {
      type: 'storage_usage',
      conditions: [
        {
          field: 'storage_gb',
          operator: 'greater_than',
          value: 0
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            base_amount: 10,
            currency: 'usd',
            interval: 'month',
            description: 'Storage base fee'
          }
        },
        {
          type: 'charge',
          params: {
            unit_amount: 0.05,
            currency: 'usd',
            description: 'Per GB charge'
          }
        }
      ],
      metadata: {
        minimum_charge: 10,
        included_storage: 20, // 20GB included in base fee
        overage_rate: 0.05   // $0.05 per GB over included amount
      }
    }
  },
  {
    id: 'user-based',
    name: 'Per-User Pricing',
    description: 'Charge based on number of active users',
    category: 'subscription',
    template: {
      type: 'per_user',
      conditions: [
        {
          field: 'active_users',
          operator: 'greater_than',
          value: 0
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            unit_amount: 10,
            currency: 'usd',
            interval: 'month',
            description: 'Per user charge'
          }
        }
      ],
      metadata: {
        minimum_users: 5,
        volume_discounts: [
          { threshold: 10, discount_percent: 10 },  // 10% off for 10+ users
          { threshold: 25, discount_percent: 15 },  // 15% off for 25+ users
          { threshold: 50, discount_percent: 20 },  // 20% off for 50+ users
          { threshold: 100, discount_percent: 25 }  // 25% off for 100+ users
        ]
      }
    }
  },
  {
    id: 'feature-based',
    name: 'Feature-Based Pricing',
    description: 'Charge based on enabled features',
    category: 'subscription',
    template: {
      type: 'feature_based',
      conditions: [
        {
          field: 'subscription_status',
          operator: 'equals',
          value: 'active'
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            base_amount: 29.99,
            currency: 'usd',
            interval: 'month',
            description: 'Base subscription'
          }
        }
      ],
      metadata: {
        features: {
          basic: {
            price: 29.99,
            features: ['Basic Analytics', 'Email Support', '5 Projects']
          },
          pro: {
            price: 59.99,
            features: ['Advanced Analytics', 'Priority Support', '15 Projects', 'API Access']
          },
          enterprise: {
            price: 119.99,
            features: ['Custom Analytics', '24/7 Support', 'Unlimited Projects', 'API Access', 'SSO']
          }
        },
        add_ons: [
          {
            id: 'additional_projects',
            name: 'Additional Projects',
            price: 5.99,
            unit: 'project'
          },
          {
            id: 'premium_support',
            name: 'Premium Support',
            price: 49.99,
            unit: 'month'
          }
        ]
      }
    }
  },
  {
    id: 'bandwidth-based',
    name: 'Bandwidth Pricing',
    description: 'Charge based on data transfer with regional pricing',
    category: 'usage',
    template: {
      type: 'bandwidth_usage',
      conditions: [
        {
          field: 'bandwidth_gb',
          operator: 'greater_than',
          value: 0
        },
        {
          field: 'region',
          operator: 'equals',
          value: 'us-east'
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            unit_amount: 0.08,
            currency: 'usd',
            description: 'Bandwidth usage'
          }
        }
      ],
      metadata: {
        regional_pricing: {
          'us-east': 0.08,
          'us-west': 0.09,
          'eu-central': 0.07,
          'ap-southeast': 0.10
        },
        included_bandwidth: 100, // 100GB included
        billing_cycle: 'monthly'
      }
    }
  },
  {
    id: 'time-based',
    name: 'Time-Based Pricing',
    description: 'Charge based on usage duration with peak/off-peak rates',
    category: 'metered',
    template: {
      type: 'time_based',
      conditions: [
        {
          field: 'usage_minutes',
          operator: 'greater_than',
          value: 0
        },
        {
          field: 'time_of_day',
          operator: 'between',
          value: ['09:00', '17:00']
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            unit_amount: 0.02,
            currency: 'usd',
            description: 'Usage time (peak)'
          }
        }
      ],
      metadata: {
        rates: {
          peak: {
            hours: ['09:00-17:00'],
            rate: 0.02
          },
          off_peak: {
            hours: ['17:00-09:00'],
            rate: 0.01
          }
        },
        minimum_charge: 1,
        rounding: 'minute'
      }
    }
  },
  {
    id: 'event-based',
    name: 'Event-Based Pricing',
    description: 'Charge based on event types and volume',
    category: 'metered',
    template: {
      type: 'event_based',
      conditions: [
        {
          field: 'event_type',
          operator: 'equals',
          value: 'process'
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            currency: 'usd',
            description: 'Event processing'
          }
        }
      ],
      metadata: {
        event_types: {
          process: { base_rate: 0.001 },
          analyze: { base_rate: 0.002 },
          store: { base_rate: 0.0005 }
        },
        volume_discounts: [
          { threshold: 100000, discount: 10 },
          { threshold: 1000000, discount: 20 },
          { threshold: 10000000, discount: 30 }
        ],
        billing_cycle: 'monthly'
      }
    }
  },
  {
    id: 'hybrid-subscription',
    name: 'Hybrid Subscription',
    description: 'Base subscription with usage-based components',
    category: 'subscription',
    template: {
      type: 'hybrid',
      conditions: [
        {
          field: 'subscription_status',
          operator: 'equals',
          value: 'active'
        }
      ],
      actions: [
        {
          type: 'charge',
          params: {
            base_amount: 99.99,
            currency: 'usd',
            interval: 'month',
            description: 'Base subscription'
          }
        }
      ],
      metadata: {
        base_plan: {
          price: 99.99,
          included_credits: 1000,
          features: ['Basic Support', 'Standard API Access']
        },
        usage_components: [
          {
            name: 'API Calls',
            rate: 0.001,
            volume_discounts: true
          },
          {
            name: 'Storage',
            rate: 0.05,
            unit: 'GB'
          },
          {
            name: 'Processing',
            rate: 0.02,
            unit: 'minute'
          }
        ],
        add_ons: [
          {
            name: 'Premium Support',
            price: 199.99,
            billing: 'monthly'
          },
          {
            name: 'Additional Credits',
            price: 0.008,
            unit: 'credit'
          }
        ]
      }
    }
  }
]; 