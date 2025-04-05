import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { EmailService } from '@/lib/services/email-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization from session context
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Initialize email service
    const emailService = new EmailService();

    // Process campaign acceptance
    await emailService.handleWinBackAcceptance(params.id, organizationId);

    return NextResponse.json({
      message: 'Win-back offer accepted successfully'
    });
  } catch (error: any) {
    console.error('Error accepting win-back offer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to accept win-back offer' },
      { status: 500 }
    );
  }
}