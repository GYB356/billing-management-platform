import { NextRequest, NextResponse } from 'next/server';
import { FraudDetectionService } from '@/lib/services/fraud-detection-service';
import { auth } from '@/lib/auth';
import { AuditService } from '@/lib/services/audit-service';

const fraudDetectionService = new FraudDetectionService();
const auditService = new AuditService();

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      amount,
      currency,
      paymentMethodId,
      billingCountry,
      deviceFingerprint
    } = body;

    // Get IP and user agent from request
    const ipAddress = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    const userAgent = req.headers.get('user-agent');

    // Assess transaction risk
    const riskAssessment = await fraudDetectionService.assessTransactionRisk({
      amount,
      currency,
      userId: session.user.id,
      ipAddress,
      paymentMethodId,
      billingCountry,
      deviceFingerprint,
      userAgent: userAgent ?? undefined
    });

    // If high risk, block the transaction
    if (riskAssessment.shouldBlock) {
      await auditService.log({
        action: 'TRANSACTION_BLOCKED',
        resourceType: 'TRANSACTION',
        resourceId: paymentMethodId,
        userId: session.user.id,
        metadata: {
          riskAssessment,
          amount,
          currency,
          ipAddress
        }
      });

      return NextResponse.json({
        status: 'blocked',
        riskLevel: riskAssessment.riskLevel,
        reasons: riskAssessment.reasons
      }, { status: 403 });
    }

    // Return risk assessment
    return NextResponse.json({
      status: 'approved',
      riskLevel: riskAssessment.riskLevel,
      requiresAdditionalVerification: riskAssessment.riskLevel === 'HIGH'
    });
  } catch (error) {
    console.error('Fraud detection error:', error);
    
    await auditService.log({
      action: 'FRAUD_DETECTION_ERROR',
      resourceType: 'TRANSACTION',
      resourceId: 'unknown',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Endpoint to report fraudulent transactions
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { transactionId, details } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    await fraudDetectionService.reportFraudulent(
      transactionId,
      session.user.id,
      details || {}
    );

    return NextResponse.json({
      status: 'success',
      message: 'Transaction marked as fraudulent'
    });
  } catch (error) {
    console.error('Fraud reporting error:', error);
    
    await auditService.log({
      action: 'FRAUD_REPORTING_ERROR',
      resourceType: 'TRANSACTION',
      resourceId: 'unknown',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}