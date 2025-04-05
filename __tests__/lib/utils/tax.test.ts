import {
  calculateTax,
  formatTaxAmount,
  formatTaxRate,
  generateTaxSummary,
} from '@/lib/utils/tax';
import { TaxRate } from '@/types/tax';

describe('Tax Utilities', () => {
  describe('calculateTax', () => {
    const mockTaxRates: TaxRate[] = [
      {
        id: '1',
        name: 'VAT',
        rate: 20,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'Service Tax',
        rate: 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('calculates tax correctly for a single tax rate', () => {
      const result = calculateTax(100, [mockTaxRates[0]]);

      expect(result.subtotal).toBe(100);
      expect(result.taxAmount).toBe(20);
      expect(result.total).toBe(120);
      expect(result.taxDetails).toHaveLength(1);
      expect(result.taxDetails[0]).toEqual({
        rate: 20,
        amount: 20,
        name: 'VAT',
      });
    });

    it('calculates tax correctly for multiple tax rates', () => {
      const result = calculateTax(100, mockTaxRates);

      expect(result.subtotal).toBe(100);
      expect(result.taxAmount).toBe(25);
      expect(result.total).toBe(125);
      expect(result.taxDetails).toHaveLength(2);
    });

    it('ignores inactive tax rates', () => {
      const inactiveTaxRate: TaxRate = {
        ...mockTaxRates[0],
        isActive: false,
      };

      const result = calculateTax(100, [inactiveTaxRate]);

      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(100);
      expect(result.taxDetails).toHaveLength(0);
    });
  });

  describe('formatTaxAmount', () => {
    it('formats tax amount as currency', () => {
      expect(formatTaxAmount(100)).toBe('$100.00');
      expect(formatTaxAmount(1000.5)).toBe('$1,000.50');
      expect(formatTaxAmount(0)).toBe('$0.00');
    });
  });

  describe('formatTaxRate', () => {
    it('formats tax rate as percentage', () => {
      expect(formatTaxRate(20)).toBe('20.00%');
      expect(formatTaxRate(5.5)).toBe('5.50%');
      expect(formatTaxRate(0)).toBe('0.00%');
    });
  });

  describe('generateTaxSummary', () => {
    it('generates a summary of tax rates', () => {
      const taxDetails = [
        { rate: 20, amount: 20, name: 'VAT' },
        { rate: 5, amount: 5, name: 'Service Tax' },
      ];

      expect(generateTaxSummary(taxDetails)).toBe(
        'VAT (20.00%), Service Tax (5.00%)'
      );
    });

    it('handles empty tax details', () => {
      expect(generateTaxSummary([])).toBe('');
    });
  });
}); 