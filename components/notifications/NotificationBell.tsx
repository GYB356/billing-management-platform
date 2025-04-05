'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: string;
}

async function getUnreadNotifications(): Promise<Notification[]> {
  const response = await fetch('/api/notifications/unread');
  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }
  return response.json();
}

async function markAsRead(notificationIds: string[]) {
  await fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationIds }),
  });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  
  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: getUnreadNotifications,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications?.length) {
      // Mark notifications as read when opening the dropdown
      await markAsRead(notifications.map(n => n.id));
      refetch();
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'ERROR':
        return 'text-red-600';
      case 'WARNING':
        return 'text-yellow-600';
      case 'SUCCESS':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications?.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : notifications?.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No new notifications
          </div>
        ) : (
          notifications?.map((notification) => (
            <DropdownMenuItem key={notification.id} className="p-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className={`font-medium ${getNotificationColor(notification.type)}`}>
                    {notification.title}
                  </p>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{notification.message}</p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}