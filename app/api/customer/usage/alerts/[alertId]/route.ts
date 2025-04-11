import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { alertId } = params;
    const body = await req.json();
    const { enabled } = body;

    // Verify the alert belongs to the user
    const alert = await prisma.usageAlert.findFirst({
      where: {
        id: alertId,
        subscription: {
          customer: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Update the alert
    const updatedAlert = await prisma.usageAlert.update({
      where: { id: alertId },
      data: { enabled },
    });

    return NextResponse.json(updatedAlert);
  } catch (error) {
    console.error('Error updating usage alert:', error);
    return NextResponse.json(
      { error: 'Failed to update usage alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { alertId } = params;

    // Verify the alert belongs to the user
    const alert = await prisma.usageAlert.findFirst({
      where: {
        id: alertId,
        subscription: {
          customer: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Delete the alert
    await prisma.usageAlert.delete({
      where: { id: alertId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting usage alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete usage alert' },
      { status: 500 }
    );
  }
}
