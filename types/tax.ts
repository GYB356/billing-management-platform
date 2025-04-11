import { Prisma } from '@prisma/client';

export type TaxRate = Prisma.TaxRateGetPayload<{}>;
export type TaxRule = Prisma.TaxRuleGetPayload<{}>;
export type TaxValidation = Prisma.TaxIdValidationGetPayload<{}>;

export const CustomerType = {
  INDIVIDUAL: 'INDIVIDUAL',
  BUSINESS: 'BUSINESS'
} as const;

export type CustomerType = typeof CustomerType[keyof typeof CustomerType];

export const TaxType = {
  VAT: 'VAT',
  GST: 'GST',
  HST: 'HST',
  PST: 'PST',
  SALES_TAX: 'SALES_TAX'
} as const;

export type TaxType = typeof TaxType[keyof typeof TaxType];

export const TaxRuleType = {
  MODIFIER: 'MODIFIER',
  OVERRIDE: 'OVERRIDE'
} as const;

export type TaxRuleType = typeof TaxRuleType[keyof typeof TaxRuleType];

export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  breakdown: Array<{
    type: TaxType;
    rate: number;
    amount: number;
    description: string;
  }>;
  appliedRules: TaxRule[];
}

export interface TaxReport {
  period: {
    startDate: string;
    endDate: string;
  };
  taxTotals: Array<{
    taxRate: {
      id: string;
      name: string;
      rate: number;
    };
    totalAmount: number;
    invoiceCount: number;
  }>;
  summary: {
    totalTaxAmount: number;
    totalInvoices: number;
  };
}

export interface TaxRateFormData {
  name: string;
  rate: number;
  description?: string;
  isActive: boolean;
}

export interface TaxRuleFormData {
  name: string;
  description?: string;
  type: TaxRuleType;
  priority: number;
  conditions: Array<{
    type: 'AMOUNT_THRESHOLD' | 'DATE_RANGE' | 'CUSTOMER_TYPE';
    threshold?: number;
    startDate?: Date;
    endDate?: Date;
    customerTypes?: CustomerType[];
  }>;
  modifier?: number;
  override?: number;
  countryCode: string;
  stateCode?: string;
  isActive?: boolean;
  organizationId: string;
}