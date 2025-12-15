import Head from 'next/head';
import { useState, useEffect } from 'react';

export default function Home() {
  const [stats, setStats] = useState({
    activeNodes: 0,
    totalJobs: 0,
    savedCost: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading stats
    setTimeout(() => {
      setStats({
        activeNodes: Math.floor(Math.random() * 50) + 10,
        totalJobs: Math.floor(Math.random() * 1000) + 500,
        savedCost: Math.floor(Math.random() * 10000) + 5000
      });
      setIsLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
      <Head>
        <title>NeuroGrid - Decentralized AI Computing Platform</title>
        <meta name="description" content="Democratizing AI computing through decentralized GPU networks" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* Navigation */}
      <nav className="relative z-10 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <span className="text-white text-xl font-bold">NeuroGrid</span>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full border border-green-500/30">
                🟢 Local Dev
              </div>
              <span className="text-gray-300">v1.0.0</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-80 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-80 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-40 left-1/2 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        </div>

        <div className="relative container mx-auto px-6 py-20">
          {/* Main Hero Content */}
          <div className="text-center mb-16">
            <div className="mb-6">
              <span className="inline-block px-4 py-2 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30 mb-6">
                🚀 Decentralized AI Computing Platform
              </span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              NeuroGrid
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Democratizing AI computing through decentralized GPU networks. 
              Save 50-85% on AI inference costs while GPU providers earn sustainable income.
            </p>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <a 
                href="/dashboard"
                className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <span className="flex items-center space-x-2">
                  <span>📊</span>
                  <span>Real-time Dashboard</span>
                </span>
              </a>
              <a 
                href="/api-test"
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <span className="flex items-center space-x-2">
                  <span>🧪</span>
                  <span>API Testing</span>
                </span>
              </a>
              <a 
                href="/tasks"
                className="group relative px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20 hover:border-white/30 backdrop-blur-sm"
              >
                <span className="flex items-center space-x-2">
                  <span>📋</span>
                  <span>Task Management</span>
                </span>
              </a>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {isLoading ? "..." : stats.activeNodes}
              </div>
              <div className="text-gray-300 text-sm uppercase tracking-wide">Active Nodes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {isLoading ? "..." : stats.totalJobs.toLocaleString()}
              </div>
              <div className="text-gray-300 text-sm uppercase tracking-wide">Jobs Completed</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">
                ${isLoading ? "..." : stats.savedCost.toLocaleString()}
              </div>
              <div className="text-gray-300 text-sm uppercase tracking-wide">Cost Savings</div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl">
                ⚡
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Lightning Fast</h3>
              <p className="text-gray-400">Optimized inference with distributed GPU computing</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl">
                💰
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Cost Efficient</h3>
              <p className="text-gray-400">Save up to 85% compared to traditional cloud services</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl">
                🌐
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Decentralized</h3>
              <p className="text-gray-400">Global network of GPU providers for maximum reliability</p>
            </div>
          </div>

          {/* Development Environment Info */}
          <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 backdrop-blur-sm rounded-2xl p-8 border border-green-500/30 mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
              <span className="text-green-400 font-semibold">Local Development Environment Active</span>
            </div>
            <div className="grid md:grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-white font-semibold mb-2">🚀 API Server</div>
                <div className="text-gray-300 font-mono text-sm">http://localhost:3001</div>
              </div>
              <div>
                <div className="text-white font-semibold mb-2">🌐 Web Interface</div>
                <div className="text-gray-300 font-mono text-sm">http://localhost:3000</div>
              </div>
            </div>
          </div>

          {/* Production Link */}
          <div className="text-center">
            <a 
              href="http://neurogrid.network" 
              className="inline-flex items-center space-x-2 px-6 py-3 bg-red-500/20 text-red-300 rounded-xl hover:bg-red-500/30 transition-all duration-200 border border-red-500/30"
            >
              <span>←</span>
              <span>Visit Production Site</span>
              <span className="text-xs">neurogrid.network</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
