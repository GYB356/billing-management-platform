self.addEventListener('push', (event) => {
  const notification = event.data.json();
  const title = notification.title;
  const options = {
    body: notification.message,
    icon: '/icons/notification-icon.png',
    badge: '/icons/notification-badge.png',
    data: notification.data,
    actions: notification.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle notification click
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

self.addEventListener('notificationclose', (event) => {
  // Optional: track when notifications are closed
  console.log('Notification closed', event.notification);
});