import Head from 'next/head';
import { useState, useEffect } from 'react';

export default function Offline() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const tryReload = () => {
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  if (isOnline) {
    // Auto-redirect when back online
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <Head>
        <title>Offline - NeuroGrid</title>
        <meta name="description" content="You are currently offline" />
      </Head>

      <div className="text-center max-w-md mx-auto px-6">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-80 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-80 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        </div>

        <div className="relative">
          {/* Status Icon */}
          <div className="w-32 h-32 mx-auto mb-8">
            <div className={`w-full h-full rounded-full flex items-center justify-center text-6xl transition-all duration-500 ${
              isOnline 
                ? 'bg-green-500/20 border-2 border-green-500/50' 
                : 'bg-red-500/20 border-2 border-red-500/50'
            }`}>
              {isOnline ? '🌐' : '📶'}
            </div>
          </div>

          {/* Status Message */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              {isOnline ? 'Back Online!' : 'You\'re Offline'}
            </h1>
            <p className="text-gray-300 text-lg">
              {isOnline 
                ? 'Great! Your connection has been restored. Redirecting...'
                : 'No internet connection detected. Please check your network and try again.'
              }
            </p>
          </div>

          {/* Connection Status */}
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-8 ${
            isOnline 
              ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`}></div>
            <span>{isOnline ? 'Connected' : 'Offline'}</span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={tryReload}
              disabled={!isOnline}
              className={`w-full px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                isOnline 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transform hover:-translate-y-1 shadow-lg hover:shadow-xl' 
                  : 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-50'
              }`}
            >
              {isOnline ? '🔄 Reload Page' : '⚠️ No Connection'}
            </button>

            <a
              href="/"
              className="block w-full px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20 hover:border-white/30 backdrop-blur-sm"
            >
              🏠 Go Home
            </a>
          </div>

          {/* Cached Content Info */}
          <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
            <h3 className="text-white font-semibold mb-2">📱 Offline Mode</h3>
            <p className="text-gray-300 text-sm">
              Some features may be available offline thanks to our Progressive Web App technology. 
              You can still view cached data and the app will sync once you're back online.
            </p>
          </div>

          {/* Network Info */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-xs">
              Connection Type: {navigator.connection?.effectiveType || 'Unknown'}
              <br />
              Last Update: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}