import { prisma } from '@/lib/prisma';
import { AuditService } from './audit-service';

export enum DataRequestType {
  ACCESS = 'ACCESS',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  UPDATE = 'UPDATE'
}

export enum PrivacyRegulation {
  GDPR = 'GDPR',
  CCPA = 'CCPA'
}

interface DataRequest {
  userId: string;
  requestType: DataRequestType;
  regulation: PrivacyRegulation;
  details?: Record<string, any>;
}

export class DataPrivacyService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  async handleDataRequest(request: DataRequest) {
    // Log the request immediately
    await this.auditService.log({
      action: `PRIVACY_REQUEST_${request.requestType}`,
      resourceType: 'USER_DATA',
      resourceId: request.userId,
      metadata: {
        regulation: request.regulation,
        requestType: request.requestType,
        timestamp: new Date().toISOString()
      }
    });

    switch (request.requestType) {
      case DataRequestType.ACCESS:
        return this.handleAccessRequest(request);
      case DataRequestType.DELETE:
        return this.handleDeleteRequest(request);
      case DataRequestType.EXPORT:
        return this.handleExportRequest(request);
      case DataRequestType.UPDATE:
        return this.handleUpdateRequest(request);
    }
  }

  private async handleAccessRequest(request: DataRequest) {
    const userData = await this.collectUserData(request.userId);
    return this.formatDataForPrivacyRequest(userData, request.regulation);
  }

  private async handleDeleteRequest(request: DataRequest) {
    // Log deletion intent
    await this.auditService.log({
      action: 'PRIVACY_DELETION_INITIATED',
      resourceType: 'USER_DATA',
      resourceId: request.userId,
      metadata: { regulation: request.regulation }
    });

    // Collect data for backup before deletion
    const userData = await this.collectUserData(request.userId);

    // Perform deletion across all relevant tables
    await prisma.$transaction([
      prisma.user.delete({ where: { id: request.userId } }),
      prisma.billingProfile.deleteMany({ where: { userId: request.userId } }),
      prisma.paymentMethod.deleteMany({ where: { userId: request.userId } }),
      // Anonymize transaction history instead of deleting
      prisma.transaction.updateMany({
        where: { userId: request.userId },
        data: { userId: null, anonymized: true }
      })
    ]);

    // Log successful deletion
    await this.auditService.log({
      action: 'PRIVACY_DELETION_COMPLETED',
      resourceType: 'USER_DATA',
      resourceId: request.userId,
      metadata: {
        regulation: request.regulation,
        deletedData: Object.keys(userData)
      }
    });
  }

  private async handleExportRequest(request: DataRequest) {
    const userData = await this.collectUserData(request.userId);
    const formattedData = this.formatDataForPrivacyRequest(userData, request.regulation);
    
    // Log export
    await this.auditService.log({
      action: 'PRIVACY_DATA_EXPORTED',
      resourceType: 'USER_DATA',
      resourceId: request.userId,
      metadata: {
        regulation: request.regulation,
        exportedFields: Object.keys(userData)
      }
    });

    return formattedData;
  }

  private async handleUpdateRequest(request: DataRequest) {
    if (!request.details) {
      throw new Error('Update details are required');
    }

    // Log update request
    await this.auditService.log({
      action: 'PRIVACY_UPDATE_INITIATED',
      resourceType: 'USER_DATA',
      resourceId: request.userId,
      metadata: {
        regulation: request.regulation,
        fieldsToUpdate: Object.keys(request.details)
      }
    });

    // Perform updates
    await prisma.user.update({
      where: { id: request.userId },
      data: request.details
    });

    return { success: true, message: 'Data updated successfully' };
  }

  private async collectUserData(userId: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          billingProfile: true,
          subscriptions: true,
          paymentMethods: {
            select: {
              id: true,
              type: true,
              last4: true,
              expiryMonth: true,
              expiryYear: true
            }
          }
        }
      });

      const transactions = await tx.transaction.findMany({
        where: { userId },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true
        }
      });

      return {
        personalData: {
          email: user?.email,
          name: user?.name,
          phone: user?.phone
        },
        billingData: user?.billingProfile,
        subscriptions: user?.subscriptions,
        paymentMethods: user?.paymentMethods,
        transactions
      };
    });
  }

  private formatDataForPrivacyRequest(
    data: Record<string, any>,
    regulation: PrivacyRegulation
  ) {
    // Format data according to regulation requirements
    const formatted = {
      personalInformation: data.personalData,
      financialInformation: {
        billingProfile: data.billingData,
        paymentMethods: data.paymentMethods.map((pm: any) => ({
          type: pm.type,
          last4: pm.last4,
          expiryDate: `${pm.expiryMonth}/${pm.expiryYear}`
        }))
      },
      transactionHistory: data.transactions,
      dataCollectionPurpose: 'Billing and subscription management',
      thirdPartyRecipients: ['Payment processors', 'Analytics providers'],
      retentionPeriod: '7 years for financial records',
      lastUpdated: new Date().toISOString()
    };

    if (regulation === PrivacyRegulation.CCPA) {
      formatted.ccpaSpecific = {
        categories: ['Personal Information', 'Financial Information'],
        sources: ['Direct from user', 'Payment processors'],
        salesOptOut: true
      };
    }

    if (regulation === PrivacyRegulation.GDPR) {
      formatted.gdprSpecific = {
        legalBasis: 'Contract performance and legitimate interests',
        dataController: 'Your Company Name',
        dpo: 'privacy@yourcompany.com',
        transferMechanisms: ['Standard Contractual Clauses']
      };
    }

    return formatted;
  }
}