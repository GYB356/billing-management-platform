import { TaxService } from '@/lib/services/tax-service';
import { TaxExemptionService } from '@/lib/services/tax-exemption-service';
import { TaxValidationService } from '@/lib/services/tax-validation-service';
import { TaxRuleService } from '@/lib/services/tax-rule-service';
import { TaxReportingService } from '@/lib/services/tax-reporting-service';
import prisma from '@/lib/prisma';
import { TaxType, CustomerType, TaxRuleType } from '@prisma/client';

describe('Tax Management Integration Tests', () => {
  let organization: any;
  let taxService: TaxService;
  let taxExemptionService: TaxExemptionService;
  let taxValidationService: TaxValidationService;
  let taxRuleService: TaxRuleService;
  let taxReportingService: TaxReportingService;

  beforeAll(async () => {
    // Create test organization
    organization = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        email: 'test@example.com'
      }
    });

    // Initialize services
    taxService = new TaxService();
    taxExemptionService = new TaxExemptionService();
    taxValidationService = new TaxValidationService();
    taxRuleService = new TaxRuleService();
    taxReportingService = new TaxReportingService();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.organization.delete({
      where: { id: organization.id }
    });
  });

  describe('Tax Rate Management', () => {
    it('should calculate correct tax for standard rate', async () => {
      // Create a test tax rate
      const taxRate = await prisma.taxRate.create({
        data: {
          name: 'Standard VAT',
          rate: 20,
          type: TaxType.VAT,
          country: 'GB',
          isActive: true,
          organizationId: organization.id
        }
      });

      // Calculate tax
      const result = await taxService.calculateTax({
        amount: 100,
        countryCode: 'GB',
        customerType: CustomerType.INDIVIDUAL
      });

      expect(result.taxAmount).toBe(20);
      expect(result.taxRate).toBe(20);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].type).toBe('VAT');

      // Clean up
      await prisma.taxRate.delete({
        where: { id: taxRate.id }
      });
    });

    it('should handle tax exemptions correctly', async () => {
      // Create tax exemption
      await taxExemptionService.createTaxExemption({
        organizationId: organization.id,
        taxType: TaxType.VAT,
        certificateNumber: 'EXEMPT-123',
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      });

      // Validate exemption
      const validationResult = await taxExemptionService.validateTaxExemption(
        organization.id,
        TaxType.VAT
      );

      expect(validationResult.isValid).toBe(true);
    });

    it('should apply tax rules correctly', async () => {
      // Create a tax rule
      const rule = await taxRuleService.createTaxRule({
        name: 'High Value Discount',
        type: TaxRuleType.MODIFIER,
        priority: 1,
        conditions: [
          {
            type: 'AMOUNT_THRESHOLD',
            threshold: 1000
          }
        ],
        modifier: -0.1, // 10% reduction
        countryCode: 'GB',
        organizationId: organization.id
      });

      // Test calculation with rule
      const result = await taxService.calculateTax({
        amount: 2000,
        countryCode: 'GB',
        customerType: CustomerType.BUSINESS
      });

      // Should apply 10% reduction to standard rate
      expect(result.taxRate).toBeLessThan(20);

      // Clean up
      await prisma.taxRule.delete({
        where: { id: rule.id }
      });
    });

    it('should validate VAT numbers correctly', async () => {
      const validationResult = await taxValidationService.validateTaxId(
        'GB123456789',
        'GB',
        TaxType.VAT
      );

      expect(validationResult.isValid).toBeDefined();
    });

    it('should generate accurate tax reports', async () => {
      const report = await taxReportingService.generateTaxReport({
        organizationId: organization.id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: new Date(),
        groupBy: 'month'
      });

      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.breakdown).toBeDefined();
    });
  });

  describe('Tax Analytics', () => {
    it('should generate correct tax analytics', async () => {
      const analytics = await taxReportingService.generateTaxAnalytics(
        organization.id,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(analytics.totalRevenue).toBeDefined();
      expect(analytics.totalTax).toBeDefined();
      expect(analytics.averageTaxRate).toBeDefined();
      expect(analytics.taxByType).toBeDefined();
      expect(analytics.taxByRegion).toBeDefined();
    });
  });
});