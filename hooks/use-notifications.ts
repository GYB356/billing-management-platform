import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: any;
  createdAt: string;
  requiresIteration?: boolean;
  iterationResponse?: boolean;
  iterationRespondedAt?: string;
}

export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // Fetch notifications from the API
  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return;

    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      
      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [session?.user]);

  // Mark a notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to mark notification as read');
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Respond to iteration
  const respondToIteration = useCallback(async (id: string, willIterate: boolean) => {
    try {
      const response = await fetch(`/api/notifications/${id}/iterate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ willIterate }),
      });
      
      if (!response.ok) throw new Error('Failed to respond to iteration');
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { 
          ...n, 
          iterationResponse: willIterate,
          iterationRespondedAt: new Date().toISOString()
        } : n)
      );
    } catch (error) {
      console.error('Error responding to iteration:', error);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!session?.user) return;

    const ws = new WebSocket(`${window.location.origin.replace('http', 'ws')}/api/notifications/ws`);
    
    ws.onmessage = (event) => {
      const newNotification = JSON.parse(event.data);
      setNotifications(prev => [newNotification, ...prev]);
      if (!newNotification.read) {
        setUnreadCount(prev => prev + 1);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWebsocket(ws);

    return () => {
      ws.close();
    };
  }, [session?.user]);

  // Initial fetch of notifications
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    respondToIteration,
    refetchNotifications: fetchNotifications,
  };
}