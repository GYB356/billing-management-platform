import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, subject, body, channels } = await request.json();

    if (!type || !subject || !body || !channels) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const template = await prisma.notificationTemplate.create({
      data: {
        type,
        subject,
        body,
        channels,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error creating notification template:', error);
    return NextResponse.json(
      { error: 'Failed to create notification template' },
      { status: 500 }
    );
  }
} 