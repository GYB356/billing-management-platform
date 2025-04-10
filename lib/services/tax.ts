import { prisma } from '@/lib/prisma';

interface TaxRate {
  id: string;
  country: string;
  state?: string;
  rate: number;
  type: 'VAT' | 'GST' | 'SALES' | 'OTHER';
  validFrom: Date;
  validTo?: Date;
}

interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  appliedRates: {
    type: string;
    rate: number;
    amount: number;
  }[];
}

export class TaxService {
  // ...rest of the code from the prompt...
}

export const taxService = TaxService.getInstance();
