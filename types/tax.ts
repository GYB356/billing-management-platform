export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  country: string;
  state?: string;
  city?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxDetails: {
    rate: number;
    amount: number;
    name: string;
  }[];
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

export interface TaxReportFormData {
  startDate: Date;
  endDate: Date;
  taxRateIds: string[];
} 