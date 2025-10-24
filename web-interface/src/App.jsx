import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Wallet, Brain, Users, Settings, Home } from 'lucide-react';
import WalletDashboard from './components/WalletDashboard';

// Mock components for other pages
const Dashboard = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">NeuroGrid Dashboard</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Active Nodes</h3>
        <p className="text-3xl font-bold text-blue-600">12</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Running Tasks</h3>
        <p className="text-3xl font-bold text-green-600">8</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Total Rewards</h3>
        <p className="text-3xl font-bold text-purple-600">456.78 NEURO</p>
      </div>
    </div>
  </div>
);

const Models = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">AI Models</h1>
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold">LLaMA 2</h3>
        <p className="text-gray-600">Large Language Model for text generation</p>
        <p className="text-sm text-blue-600">Cost: 0.1 NEURO per task</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold">Stable Diffusion</h3>
        <p className="text-gray-600">Image generation model</p>
        <p className="text-sm text-blue-600">Cost: 0.2 NEURO per task</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold">Whisper</h3>
        <p className="text-gray-600">Speech recognition model</p>
        <p className="text-sm text-blue-600">Cost: 0.05 NEURO per task</p>
      </div>
    </div>
  </div>
);

const Nodes = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Compute Nodes</h1>
    <div className="bg-white p-4 rounded-lg shadow">
      <p className="text-gray-600">Node management interface coming soon...</p>
    </div>
  </div>
);

const Settings = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Settings</h1>
    <div className="bg-white p-4 rounded-lg shadow">
      <p className="text-gray-600">Settings interface coming soon...</p>
    </div>
  </div>
);

// Navigation component
const Navigation = () => {
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/wallet', icon: Wallet, label: 'Wallet' },
    { path: '/models', icon: Brain, label: 'AI Models' },
    { path: '/nodes', icon: Users, label: 'Nodes' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <nav className="bg-gray-800 text-white h-screen w-64 fixed left-0 top-0 p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold">NeuroGrid</h1>
        <p className="text-gray-300 text-sm">Decentralized AI Platform</p>
      </div>
      
      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      
      <div className="absolute bottom-4 left-4 right-4">
        <div className="text-xs text-gray-400">
          <p>Phase 1 TestNet</p>
          <p>v1.0.0-beta</p>
        </div>
      </div>
    </nav>
  );
};

// Main App component
const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        
        <main className="ml-64">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wallet" element={<WalletDashboard />} />
            <Route path="/models" element={<Models />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;