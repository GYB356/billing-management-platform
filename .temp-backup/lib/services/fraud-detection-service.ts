import { prisma } from '@/lib/prisma';
import { AuditService } from './audit-service';

interface FraudDetectionConfig {
  maxFailedAttempts: number;
  timeWindowMinutes: number;
  velocityThreshold: number;
  maxAmountThreshold: number;
  highRiskCountries: string[];
}

export enum FraudRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

interface TransactionData {
  amount: number;
  currency: string;
  userId: string;
  ipAddress: string;
  paymentMethodId: string;
  billingCountry: string;
  deviceFingerprint?: string;
  userAgent?: string;
}

export class FraudDetectionService {
  private auditService: AuditService;
  private config: FraudDetectionConfig;

  constructor() {
    this.auditService = new AuditService();
    this.config = {
      maxFailedAttempts: 5,
      timeWindowMinutes: 60,
      velocityThreshold: 10,
      maxAmountThreshold: 10000,
      highRiskCountries: ['XX', 'YY'] // Replace with actual high-risk country codes
    };
  }

  async assessTransactionRisk(transaction: TransactionData): Promise<{
    riskLevel: FraudRiskLevel;
    reasons: string[];
    shouldBlock: boolean;
  }> {
    const reasons: string[] = [];
    let riskScore = 0;

    // Check transaction velocity
    const recentTransactions = await this.getRecentTransactions(
      transaction.userId,
      this.config.timeWindowMinutes
    );
    
    if (recentTransactions.length >= this.config.velocityThreshold) {
      reasons.push('Unusual transaction velocity detected');
      riskScore += 30;
    }

    // Check for multiple failed attempts
    const failedAttempts = await this.getFailedAttempts(
      transaction.userId,
      transaction.ipAddress
    );
    
    if (failedAttempts >= this.config.maxFailedAttempts) {
      reasons.push('Multiple failed payment attempts');
      riskScore += 25;
    }

    // Check transaction amount
    if (transaction.amount > this.config.maxAmountThreshold) {
      reasons.push('Unusually large transaction amount');
      riskScore += 20;
    }

    // Location-based risk assessment
    if (this.config.highRiskCountries.includes(transaction.billingCountry)) {
      reasons.push('Transaction from high-risk location');
      riskScore += 25;
    }

    // Device fingerprint analysis
    if (transaction.deviceFingerprint) {
      const deviceHistory = await this.getDeviceHistory(transaction.deviceFingerprint);
      if (deviceHistory.length > 5) {
        reasons.push('Device associated with multiple users');
        riskScore += 15;
      }
    }

    // IP address analysis
    const ipRisk = await this.assessIPRisk(transaction.ipAddress);
    if (ipRisk.isProxy) {
      reasons.push('Transaction from proxy/VPN');
      riskScore += 20;
    }

    // Determine risk level based on cumulative score
    let riskLevel: FraudRiskLevel;
    if (riskScore >= 75) {
      riskLevel = FraudRiskLevel.CRITICAL;
    } else if (riskScore >= 50) {
      riskLevel = FraudRiskLevel.HIGH;
    } else if (riskScore >= 25) {
      riskLevel = FraudRiskLevel.MEDIUM;
    } else {
      riskLevel = FraudRiskLevel.LOW;
    }

    // Log the risk assessment
    await this.auditService.log({
      action: 'FRAUD_RISK_ASSESSMENT',
      resourceType: 'TRANSACTION',
      resourceId: transaction.paymentMethodId,
      userId: transaction.userId,
      metadata: {
        riskLevel,
        riskScore,
        reasons,
        transactionAmount: transaction.amount,
        currency: transaction.currency
      }
    });

    return {
      riskLevel,
      reasons,
      shouldBlock: riskLevel === FraudRiskLevel.CRITICAL || 
                  (riskLevel === FraudRiskLevel.HIGH && transaction.amount > 1000)
    };
  }

  private async getRecentTransactions(userId: string, minutes: number) {
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    
    return prisma.transaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: timeThreshold
        }
      }
    });
  }

  private async getFailedAttempts(userId: string, ipAddress: string) {
    const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const failedAttempts = await prisma.securityEvent.count({
      where: {
        OR: [
          { userId },
          { ipAddress }
        ],
        eventType: 'PAYMENT_FAILURE',
        createdAt: {
          gte: timeThreshold
        }
      }
    });

    return failedAttempts;
  }

  private async getDeviceHistory(deviceFingerprint: string) {
    return prisma.userDevice.findMany({
      where: {
        deviceFingerprint
      },
      distinct: ['userId']
    });
  }

  private async assessIPRisk(ipAddress: string) {
    // Implement IP risk assessment logic here
    // This could include:
    // 1. Check against IP reputation databases
    // 2. Geolocation analysis
    // 3. Proxy/VPN detection
    return {
      isProxy: false, // Replace with actual implementation
      riskScore: 0
    };
  }

  async reportFraudulent(
    transactionId: string,
    reportedBy: string,
    details: Record<string, any>
  ) {
    // Log the fraud report
    await this.auditService.log({
      action: 'FRAUD_REPORTED',
      resourceType: 'TRANSACTION',
      resourceId: transactionId,
      userId: reportedBy,
      metadata: {
        reportTimestamp: new Date().toISOString(),
        details
      }
    });

    // Mark transaction as fraudulent
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'FRAUDULENT',
        fraudDetails: details
      }
    });

    // Update risk profiles
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { paymentMethod: true }
    });

    if (transaction) {
      // Block the payment method
      await prisma.paymentMethod.update({
        where: { id: transaction.paymentMethod.id },
        data: { status: 'BLOCKED' }
      });

      // Update user risk profile
      await prisma.userRiskProfile.upsert({
        where: { userId: transaction.userId },
        create: {
          userId: transaction.userId,
          riskLevel: FraudRiskLevel.HIGH,
          lastUpdated: new Date(),
          fraudulentActivityCount: 1
        },
        update: {
          riskLevel: FraudRiskLevel.HIGH,
          lastUpdated: new Date(),
          fraudulentActivityCount: { increment: 1 }
        }
      });
    }
  }
}