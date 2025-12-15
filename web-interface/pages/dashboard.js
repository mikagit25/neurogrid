import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function RealtimeDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [networkMetrics, setNetworkMetrics] = useState({
    totalNodes: 0,
    activeNodes: 0,
    totalTasks: 0,
    networkLoad: 0,
    avgResponseTime: 0,
    throughput: 0,
    errorRate: 0
  });
  const [nodeMetrics, setNodeMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [performanceHistory, setPerformanceHistory] = useState([]);
  
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket for real-time updates
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001/ws');
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to WebSocket');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current = ws;
    };

    // Initial data fetch
    fetchInitialData();
    
    // Connect WebSocket
    connectWebSocket();

    // Set up periodic data refresh
    const interval = setInterval(fetchRealtimeData, 5000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      clearInterval(interval);
    };
  }, []);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'networkMetrics':
        setNetworkMetrics(data.data);
        break;
      case 'nodeMetrics':
        setNodeMetrics(data.data);
        break;
      case 'alert':
        setAlerts(prev => [data.data, ...prev.slice(0, 9)]);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [networkRes, nodesRes, alertsRes] = await Promise.all([
        fetch('http://localhost:3001/api/v2/analytics/realtime/network'),
        fetch('http://localhost:3001/api/v2/analytics/realtime/nodes'),
        fetch('http://localhost:3001/api/v2/analytics/alerts')
      ]);

      if (networkRes.ok) {
        const networkData = await networkRes.json();
        setNetworkMetrics(networkData.data);
      }

      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setNodeMetrics(nodesData.data.nodes);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.data.alerts);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchRealtimeData = async () => {
    try {
      const networkRes = await fetch('http://localhost:3001/api/v2/analytics/realtime/network');
      if (networkRes.ok) {
        const networkData = await networkRes.json();
        setNetworkMetrics(networkData.data);
        
        // Add to performance history
        setPerformanceHistory(prev => [
          ...prev.slice(-19), // Keep last 19 points
          {
            timestamp: networkData.data.timestamp,
            throughput: networkData.data.throughput,
            errorRate: networkData.data.errorRate,
            networkLoad: networkData.data.networkLoad
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching realtime data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
      <Head>
        <title>NeuroGrid - Real-time Dashboard</title>
        <meta name="description" content="Real-time network monitoring dashboard" />
      </Head>

      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a href="/" className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="text-white text-xl font-bold">NeuroGrid</span>
              </a>
              <span className="text-gray-400">|</span>
              <h1 className="text-white text-lg font-semibold">Real-time Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isConnected 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                  <span>{isConnected ? 'Live' : 'Disconnected'}</span>
                </div>
              </div>
              <span className="text-gray-300 text-sm">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Active Nodes"
            value={`${networkMetrics.activeNodes}/${networkMetrics.totalNodes}`}
            percentage={networkMetrics.totalNodes > 0 ? (networkMetrics.activeNodes / networkMetrics.totalNodes) * 100 : 0}
            color="blue"
          />
          <MetricCard
            title="Network Load"
            value={`${networkMetrics.networkLoad.toFixed(1)}%`}
            percentage={networkMetrics.networkLoad}
            color="purple"
          />
          <MetricCard
            title="Throughput"
            value={`${networkMetrics.throughput} tasks/min`}
            percentage={Math.min(networkMetrics.throughput / 10, 100)}
            color="cyan"
          />
          <MetricCard
            title="Error Rate"
            value={`${networkMetrics.errorRate.toFixed(2)}%`}
            percentage={networkMetrics.errorRate}
            color="red"
            isError={true}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Performance Chart */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h3 className="text-white text-lg font-semibold mb-4">Performance Trends</h3>
            <div className="h-64 flex items-end space-x-2">
              {performanceHistory.map((point, index) => (
                <div key={index} className="flex-1 flex flex-col items-center space-y-1">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t"
                    style={{ height: `${Math.max(point.throughput / 2, 5)}px` }}
                  ></div>
                  <div className="text-xs text-gray-400 transform -rotate-45 origin-bottom-left">
                    {new Date(point.timestamp).toLocaleTimeString().slice(0, -3)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Panel */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h3 className="text-white text-lg font-semibold mb-4">
              System Alerts
              {alerts.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">
                  {alerts.length}
                </span>
              )}
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-2xl mb-2">✅</div>
                  <p>All systems operational</p>
                </div>
              ) : (
                alerts.map((alert, index) => (
                  <AlertItem key={alert.id || index} alert={alert} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top Nodes */}
        <div className="mt-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h3 className="text-white text-lg font-semibold mb-4">Active Nodes</h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {nodeMetrics.slice(0, 6).map((node, index) => (
                <NodeCard key={node.nodeId} node={node} rank={index + 1} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, percentage, color, isError = false }) {
  const getColorClasses = (color, isError) => {
    if (isError) {
      return percentage > 10 
        ? 'from-red-500 to-red-600 border-red-500/30'
        : 'from-green-500 to-green-600 border-green-500/30';
    }
    
    const colors = {
      blue: 'from-blue-500 to-blue-600 border-blue-500/30',
      purple: 'from-purple-500 to-purple-600 border-purple-500/30',
      cyan: 'from-cyan-500 to-cyan-600 border-cyan-500/30',
      red: 'from-red-500 to-red-600 border-red-500/30'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
      <div className="text-gray-300 text-sm mb-1">{title}</div>
      <div className="text-white text-2xl font-bold mb-2">{value}</div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div 
          className={`bg-gradient-to-r ${getColorClasses(color, isError)} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

// Alert Item Component
function AlertItem({ alert }) {
  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'border-red-500/50 bg-red-500/10 text-red-300',
      warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
      info: 'border-blue-500/50 bg-blue-500/10 text-blue-300'
    };
    return colors[severity] || colors.info;
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🔴',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[severity] || icons.info;
  };

  return (
    <div className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
      <div className="flex items-start space-x-2">
        <span className="text-sm">{getSeverityIcon(alert.severity)}</span>
        <div className="flex-1">
          <div className="font-medium text-sm">{alert.message}</div>
          <div className="text-xs opacity-75 mt-1">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Node Card Component
function NodeCard({ node, rank }) {
  const getStatusColor = (status) => {
    const colors = {
      online: 'text-green-400',
      offline: 'text-red-400',
      busy: 'text-yellow-400',
      maintenance: 'text-blue-400'
    };
    return colors[status] || colors.offline;
  };

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">#{rank}</span>
          <span className="text-white font-medium text-sm">{node.nodeId.slice(0, 8)}...</span>
        </div>
        <span className={`text-xs ${getStatusColor(node.status)}`}>
          {node.status}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">CPU</span>
          <span className="text-white">{node.cpuUsage?.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Memory</span>
          <span className="text-white">{node.memoryUsage?.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Tasks</span>
          <span className="text-white">{node.activeTasks || 0}</span>
        </div>
      </div>
    </div>
  );
}