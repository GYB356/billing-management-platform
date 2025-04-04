import { TaxRate } from '@prisma/client';
import { formatTaxAmount, formatTaxRate } from '@/lib/utils/tax-calculations';

interface TaxCalculationDisplayProps {
  subtotal: number;
  taxRate: TaxRate;
  taxAmount: number;
  total: number;
}

export function TaxCalculationDisplay({
  subtotal,
  taxRate,
  taxAmount,
  total,
}: TaxCalculationDisplayProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatTaxAmount(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>
          Tax ({formatTaxRate(taxRate.rate)} - {taxRate.name})
        </span>
        <span>{formatTaxAmount(taxAmount)}</span>
      </div>
      <div className="flex justify-between font-medium">
        <span>Total</span>
        <span>{formatTaxAmount(total)}</span>
      </div>
    </div>
  );
}

interface MultipleTaxCalculationDisplayProps {
  subtotal: number;
  taxCalculations: Array<{
    taxRate: TaxRate;
    taxAmount: number;
  }>;
  total: number;
}

export function MultipleTaxCalculationDisplay({
  subtotal,
  taxCalculations,
  total,
}: MultipleTaxCalculationDisplayProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatTaxAmount(subtotal)}</span>
      </div>
      {taxCalculations.map((calc) => (
        <div key={calc.taxRate.id} className="flex justify-between text-sm">
          <span>
            Tax ({formatTaxRate(calc.taxRate.rate)} - {calc.taxRate.name})
          </span>
          <span>{formatTaxAmount(calc.taxAmount)}</span>
        </div>
      ))}
      <div className="flex justify-between font-medium">
        <span>Total</span>
        <span>{formatTaxAmount(total)}</span>
      </div>
    </div>
  );
} 