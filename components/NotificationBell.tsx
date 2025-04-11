'use client';

import { useState, useEffect } from 'react';
import { Menu } from '@headlessui/react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/types';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setError('Failed to update notification');
    }
  };

  const markAllAsRead = async () => {
    try {
      setError(null);
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setError('Failed to update notifications');
    }
  };

  if (error) {
    return (
      <div className="text-red-500">
        <BellIcon className="h-6 w-6" />
        <span className="sr-only">Error loading notifications</span>
      </div>
    );
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="relative p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
        <span className="sr-only">View notifications</span>
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-center text-xs font-medium text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </Menu.Button>

      <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">No notifications</div>
          ) : (
            notifications.map((notification) => (
              <Menu.Item key={notification.id}>
                {({ active }) => (
                  <div
                    className={`px-4 py-2 text-sm ${
                      active ? 'bg-gray-100' : ''
                    } ${!notification.read ? 'bg-indigo-50' : ''}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="font-medium text-gray-900">
                      {notification.title}
                    </div>
                    <div className="text-gray-500">{notification.message}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </Menu.Item>
            ))
          )}
        </div>
      </Menu.Items>
    </Menu>
  );
}