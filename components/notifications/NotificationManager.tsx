import React, { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { pushNotificationService } from '@/lib/push-notification-service';

export function NotificationManager() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    updateNotificationPreferences,
  } = useNotifications();

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const checkPushSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setPushSupported(supported);
      if (supported) {
        checkPushSubscription();
      }
    };

    checkPushSupport();
  }, []);

  const checkPushSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
  };

  const enablePushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get the VAPID public key from environment variables
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      // Save the subscription on the server
      await pushNotificationService.saveSubscription(subscription);
      setPushEnabled(true);

      // Update user preferences
      await updateNotificationPreferences('SYSTEM', { push: true });
    } catch (err) {
      console.error('Error enabling push notifications:', err);
    }
  };

  const disablePushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await pushNotificationService.removeSubscription(subscription.endpoint);
        setPushEnabled(false);
        await updateNotificationPreferences('SYSTEM', { push: false });
      }
    } catch (err) {
      console.error('Error disabling push notifications:', err);
    }
  };

  if (loading) {
    return <div>Loading notifications...</div>;
  }

  if (error) {
    return <div>Error loading notifications: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Notifications ({unreadCount} unread)</h2>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      {pushSupported && (
        <div className="flex items-center space-x-2">
          <span>Push notifications:</span>
          <button
            onClick={pushEnabled ? disablePushNotifications : enablePushNotifications}
            className={`px-3 py-1 rounded ${
              pushEnabled
                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            {pushEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border ${
              notification.readAt ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            <div className="flex justify-between">
              <h3 className="font-medium">{notification.title}</h3>
              {!notification.readAt && (
                <button
                  onClick={() => markAsRead([notification.id])}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark as read
                </button>
              )}
            </div>
            <p className="text-gray-600 mt-1">{notification.message}</p>
            <div className="text-sm text-gray-500 mt-2">
              {new Date(notification.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}