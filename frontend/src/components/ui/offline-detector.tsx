'use client';

/**
 * Offline Detector
 * Shows a banner when user is offline
 */

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial state
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm font-medium">
          You are offline. Changes will sync when you reconnect.
        </span>
      </div>
    </div>
  );
}
