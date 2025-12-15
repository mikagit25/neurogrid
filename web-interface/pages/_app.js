import '../src/index.css';
import PWAManager from '../src/components/PWAManager';
import { useEffect } from 'react';

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Initialize PWA features
    if (typeof window !== 'undefined') {
      // Handle online/offline events
      const handleOnline = () => {
        console.log('App is back online');
        // Sync any pending data
      };
      
      const handleOffline = () => {
        console.log('App is offline');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Handle visibility change (tab focus/blur)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // App became visible, refresh data if needed
          console.log('App became visible');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <PWAManager />
    </>
  );
}