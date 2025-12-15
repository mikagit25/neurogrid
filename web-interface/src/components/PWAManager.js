import { useEffect, useState } from 'react';

export default function PWAManager() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Register service worker
    registerServiceWorker();

    // Handle install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setSwRegistration(registration);

        // Update service worker if needed
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                showUpdateNotification();
              }
            });
          }
        });

        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const showUpdateNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('NeuroGrid Update Available', {
        body: 'A new version of NeuroGrid is available. Refresh to update.',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'update-available',
        renotify: true,
        actions: [
          {
            action: 'update',
            title: 'Update Now'
          }
        ]
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  // Auto-request notification permission on first visit
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(requestNotificationPermission, 5000);
    }
  }, []);

  return (
    <>
      {/* Install App Banner */}
      {isInstallable && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
          <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 rounded-xl shadow-lg border border-white/20 backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">📱 Install NeuroGrid</h4>
                <p className="text-xs opacity-90 mb-3">
                  Install our app for a better experience with offline support and faster loading.
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleInstall}
                    className="px-3 py-1.5 bg-white/20 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
                  >
                    Install
                  </button>
                  <button
                    onClick={() => setIsInstallable(false)}
                    className="px-3 py-1.5 bg-transparent rounded-lg text-xs opacity-75 hover:opacity-100 transition-opacity"
                  >
                    Later
                  </button>
                </div>
              </div>
              <button
                onClick={() => setIsInstallable(false)}
                className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Status Indicator (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 z-40">
          <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-xs">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                swRegistration ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span>PWA: {swRegistration ? 'Active' : 'Loading'}</span>
            </div>
            {isInstalled && (
              <div className="text-green-300 mt-1">✅ App Installed</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}