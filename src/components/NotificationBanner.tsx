'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Notification {
  type: 'warning' | 'error' | 'success';
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

export function NotificationBanner() {
  const { data: session } = useSession();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotification = async () => {
      try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        if (response.ok && data.notification) {
          setNotification(data.notification);
        }
      } catch (err) {
        console.error('Failed to fetch notification:', err);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchNotification();
    }
  }, [session]);

  if (loading || !notification) {
    return null;
  }

  const getNotificationStyles = () => {
    switch (notification.type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={`mb-6 border rounded-md p-4 ${getNotificationStyles()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {notification.type === 'warning' && (
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {notification.type === 'error' && (
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          {notification.type === 'success' && (
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          <p className="ml-3 text-sm font-medium">{notification.message}</p>
        </div>
        {notification.action && (
          <div className="ml-4">
            <a
              href={notification.action.href}
              className="text-sm font-medium underline hover:text-opacity-75"
            >
              {notification.action.label}
            </a>
          </div>
        )}
      </div>
    </div>
  );
} 