export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      
      // Log success message
      console.log('ServiceWorker registration successful with scope:', registration.scope);
      
      return registration;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      throw error;
    }
  }
  throw new Error('Service workers are not supported');
}

export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.unregister();
  }
}