'use client';

import { useEffect } from 'react';

/**
 * Client component that handles service worker registration
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('SW registered:', registration);
        } catch (error) {
          console.error('SW registration failed:', error instanceof Error ? error.message : error);
        }
      });
    }
  }, []);

  return null;
} 