import prisma from '@/lib/prisma';
import { type TaxExemption, TaxType } from '@prisma/client';
import { createEvent, EventType } from '@/lib/events';

interface TaxExemptionCreateParams {
  organizationId: string;
  taxType: TaxType | 'ALL';
  certificateNumber?: string;
  certificateUrl?: string;
  validUntil?: Date;
  reason?: string;
}

interface TaxExemptionValidationResult {
  isValid: boolean;
  expiresAt?: Date;
  errors?: string[];
}

export class TaxExemptionService {
  /**
   * Create a new tax exemption
   */
  public async createTaxExemption(params: TaxExemptionCreateParams) {
    const { organizationId, taxType, certificateNumber, certificateUrl, validUntil, reason } = params;

    // Check for existing active exemption
    const existingExemption = await prisma.taxExemption.findFirst({
      where: {
        organizationId,
        taxType,
        isActive: true,
        validUntil: {
          gte: new Date()
        }
      }
    });

    if (existingExemption) {
      throw new Error(`Active tax exemption already exists for ${taxType}`);
    }

    // Create new exemption
    const exemption = await prisma.taxExemption.create({
      data: {
        organizationId,
        taxType,
        certificateNumber,
        certificateUrl,
        validUntil,
        reason,
        isActive: true
      }
    });

    // Log exemption creation
    await createEvent({
      eventType: EventType.TAX_EXEMPTION_CREATED,
      resourceType: 'TAX_EXEMPTION',
      resourceId: exemption.id,
      metadata: {
        organizationId,
        taxType,
        validUntil
      }
    });

    return exemption;
  }

  /**
   * Validate tax exemption status
   */
  public async validateTaxExemption(
    organizationId: string,
    taxType: TaxType | 'ALL'
  ): Promise<TaxExemptionValidationResult> {
    const exemption = await prisma.taxExemption.findFirst({
      where: {
        organizationId,
        OR: [
          { taxType },
          { taxType: 'ALL' }
        ],
        isActive: true,
        validUntil: {
          gte: new Date()
        }
      }
    });

    if (!exemption) {
      return {
        isValid: false,
        errors: ['No active tax exemption found']
      };
    }

    // Check certificate expiration
    if (exemption.validUntil) {
      const daysUntilExpiration = Math.ceil(
        (exemption.validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Warn if exemption is expiring soon (30 days)
      if (daysUntilExpiration <= 30) {
        await createEvent({
          eventType: EventType.TAX_EXEMPTION_EXPIRING,
          resourceType: 'TAX_EXEMPTION',
          resourceId: exemption.id,
          metadata: {
            organizationId,
            daysUntilExpiration
          }
        });
      }
    }

    return {
      isValid: true,
      expiresAt: exemption.validUntil
    };
  }

  /**
   * Revoke tax exemption
   */
  public async revokeTaxExemption(
    exemptionId: string,
    reason: string
  ) {
    const exemption = await prisma.taxExemption.update({
      where: { id: exemptionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revocationReason: reason
      }
    });

    await createEvent({
      eventType: EventType.TAX_EXEMPTION_REVOKED,
      resourceType: 'TAX_EXEMPTION',
      resourceId: exemptionId,
      metadata: {
        organizationId: exemption.organizationId,
        reason
      }
    });

    return exemption;
  }
}