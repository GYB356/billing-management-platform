import { prisma } from '@/lib/prisma';
import { Payment, Customer } from '@prisma/client';

interface RiskScore {
  score: number;
  factors: string[];
  recommendation: 'allow' | 'review' | 'block';
}

export class FraudDetectionService {
  private readonly RISK_THRESHOLDS = {
    LOW: 30,
    MEDIUM: 70,
    HIGH: 100
  };

  async assessPaymentRisk(
    payment: Payment,
    customer: Customer
  ): Promise<RiskScore> {
    const factors: string[] = [];
    let score = 0;

    // Amount-based risk
    if (payment.amount > 10000) {
      score += 30;
      factors.push('High payment amount');
    } else if (payment.amount > 5000) {
      score += 20;
      factors.push('Medium payment amount');
    }

    // Location-based risk
    const locationRisk = await this.assessLocationRisk(customer);
    score += locationRisk.score;
    factors.push(...locationRisk.factors);

    // Velocity-based risk
    const velocityRisk = await this.assessVelocityRisk(customer);
    score += velocityRisk.score;
    factors.push(...velocityRisk.factors);

    // Device/browser risk
    const deviceRisk = await this.assessDeviceRisk(payment);
    score += deviceRisk.score;
    factors.push(...deviceRisk.factors);

    // Determine recommendation
    const recommendation = this.getRecommendation(score);

    return {
      score,
      factors,
      recommendation
    };
  }

  private async assessLocationRisk(customer: Customer): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check for high-risk countries
    const highRiskCountries = ['RU', 'CN', 'KP', 'IR'];
    if (highRiskCountries.includes(customer.country)) {
      score += 40;
      factors.push('High-risk country');
    }

    // Check for IP geolocation mismatch
    const ipMismatch = await this.checkIPLocationMismatch(customer);
    if (ipMismatch) {
      score += 30;
      factors.push('IP location mismatch');
    }

    return { score, factors };
  }

  private async assessVelocityRisk(customer: Customer): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where: {
        customerId: customer.id,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Check for multiple payments in short time
    if (recentPayments.length > 5) {
      score += 30;
      factors.push('High payment frequency');
    }

    // Check for increasing payment amounts
    const increasingAmounts = this.checkIncreasingAmounts(recentPayments);
    if (increasingAmounts) {
      score += 20;
      factors.push('Increasing payment amounts');
    }

    return { score, factors };
  }

  private async assessDeviceRisk(payment: Payment): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check for suspicious device characteristics
    const deviceData = payment.metadata?.deviceData;
    if (deviceData) {
      if (deviceData.isProxy) {
        score += 40;
        factors.push('Proxy/VPN detected');
      }
      if (deviceData.isTor) {
        score += 50;
        factors.push('Tor network detected');
      }
    }

    return { score, factors };
  }

  private getRecommendation(score: number): 'allow' | 'review' | 'block' {
    if (score < this.RISK_THRESHOLDS.LOW) {
      return 'allow';
    } else if (score < this.RISK_THRESHOLDS.MEDIUM) {
      return 'review';
    } else {
      return 'block';
    }
  }

  private async checkIPLocationMismatch(customer: Customer): Promise<boolean> {
    // Implement IP geolocation check
    // This is a placeholder - implement actual IP check
    return false;
  }

  private checkIncreasingAmounts(payments: Payment[]): boolean {
    if (payments.length < 3) return false;
    
    const amounts = payments.map(p => p.amount);
    for (let i = 1; i < amounts.length; i++) {
      if (amounts[i] <= amounts[i - 1]) {
        return false;
      }
    }
    return true;
  }
} 