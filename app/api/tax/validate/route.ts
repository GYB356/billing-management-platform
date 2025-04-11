import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TaxValidationService } from '@/lib/services/tax-validation-service';
import { z } from 'zod';

const validationRequestSchema = z.object({
  taxId: z.string().min(1),
  countryCode: z.string().length(2),
  type: z.enum(['VAT', 'GST', 'HST', 'PST', 'SALES_TAX']).default('VAT')
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = validationRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { taxId, countryCode, type } = validationResult.data;

    // Format tax ID (remove spaces and special characters)
    const formattedTaxId = taxId.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // Basic format validation based on country and type
    if (!isValidFormat(formattedTaxId, countryCode, type)) {
      return NextResponse.json(
        { error: 'Invalid tax ID format' },
        { status: 400 }
      );
    }

    const validationService = new TaxValidationService();
    const result = await validationService.validateTaxId(
      formattedTaxId,
      countryCode.toUpperCase(),
      type
    );

    return NextResponse.json({
      success: true,
      isValid: result.isValid,
      details: {
        name: result.name,
        address: result.address,
        validatedAt: result.validatedAt,
        validUntil: result.validUntil,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Error validating tax ID:', error);
    return NextResponse.json(
      { error: 'Failed to validate tax ID' },
      { status: 500 }
    );
  }
}

function isValidFormat(taxId: string, countryCode: string, type: string): boolean {
  const formatPatterns: Record<string, Record<string, RegExp>> = {
    VAT: {
      // EU VAT number formats
      AT: /^ATU\d{8}$/,
      BE: /^BE[0-1]\d{9}$/,
      BG: /^BG\d{9,10}$/,
      CY: /^CY\d{8}[A-Z]$/,
      CZ: /^CZ\d{8,10}$/,
      DE: /^DE\d{9}$/,
      DK: /^DK\d{8}$/,
      EE: /^EE\d{9}$/,
      ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
      FI: /^FI\d{8}$/,
      FR: /^FR[A-HJ-NP-Z0-9][A-HJ-NP-Z0-9]\d{9}$/,
      GB: /^GB(\d{9}|\d{12}|(HA|GD)\d{3})$/,
      GR: /^(EL|GR)\d{9}$/,
      HR: /^HR\d{11}$/,
      HU: /^HU\d{8}$/,
      IE: /^IE\d{7}[A-Z]{1,2}$/,
      IT: /^IT\d{11}$/,
      LT: /^LT(\d{9}|\d{12})$/,
      LU: /^LU\d{8}$/,
      LV: /^LV\d{11}$/,
      MT: /^MT\d{8}$/,
      NL: /^NL\d{9}B\d{2}$/,
      PL: /^PL\d{10}$/,
      PT: /^PT\d{9}$/,
      RO: /^RO\d{2,10}$/,
      SE: /^SE\d{12}$/,
      SI: /^SI\d{8}$/,
      SK: /^SK\d{10}$/
    },
    GST: {
      // GST number formats
      AU: /^AU\d{11}$/,
      IN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      NZ: /^NZ\d{9}$/
    }
  };

  const pattern = formatPatterns[type]?.[countryCode];
  if (!pattern) {
    // If no specific pattern exists, accept any alphanumeric string
    return /^[A-Z0-9]{4,}$/.test(taxId);
  }

  return pattern.test(taxId);
}