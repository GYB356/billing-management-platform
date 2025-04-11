import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { NotificationService } from '@/lib/notification-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { willIterate } = await request.json();
    const notificationService = new NotificationService();
    
    await notificationService.handleIterationResponse(
      params.id,
      session.user.id,
      willIterate
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling iteration response:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}