import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import apiConfig from '../config/api';

export default function Navigation() {
  const router = useRouter();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    setConfig(apiConfig.getConfig());
  }, []);

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/api-test', label: 'API Test', icon: '🧪' },
    { href: '/tasks', label: 'Tasks', icon: '📋' },
    { href: '/api-docs.html', label: 'API Docs', icon: '📚' }
  ];

  return (
    <nav className="relative z-10 bg-black/20 backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <a href="/" className="text-white text-xl font-bold hover:text-blue-300 transition-colors">
              NeuroGrid
            </a>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-4">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    router.pathname === item.href
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>

            {/* Status Indicator */}
            <div className="flex items-center space-x-4 text-sm">
              <div className={`px-3 py-1 rounded-full border ${
                config?.environment === 'production' 
                  ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                  : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
              }`}>
                {config?.environment === 'production' ? '🟢 Production' : '🟡 Development'}
              </div>
              <span className="text-gray-300">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}