import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { headers } from 'next/headers';

// Map to store active WebSocket connections
const clients = new Map<string, WebSocket>();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Ensure it's a WebSocket request
  if (!req.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
    return new Response('Expected WebSocket connection', { status: 426 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Store the WebSocket connection with the user's ID
    clients.set(session.user.id, socket);

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.onclose = () => {
      clients.delete(session.user.id);
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      clients.delete(session.user.id);
    };

    return response;
  } catch (error) {
    console.error('Error handling WebSocket connection:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper function to send notifications to connected clients
export async function sendNotificationToUser(userId: string, notification: any) {
  const socket = clients.get(userId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(notification));
  }
}