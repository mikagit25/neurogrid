import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Award, 
  Shield, 
  Activity,
  Users,
  Star,
  Clock,
  CheckCircle
} from 'lucide-react';

const NodeReputationDashboard = () => {
  const [reputationStats, setReputationStats] = useState(null);
  const [topNodes, setTopNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReputationData();
    const interval = setInterval(loadReputationData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadReputationData = async () => {
    try {
      setLoading(true);
      
      // Load overall stats
      const statsResponse = await fetch('/api/reputation/stats');
      if (!statsResponse.ok) throw new Error('Failed to load reputation stats');
      const statsData = await statsResponse.json();
      setReputationStats(statsData.data);

      // Load top nodes
      const topNodesResponse = await fetch('/api/reputation/top?limit=20');
      if (!topNodesResponse.ok) throw new Error('Failed to load top nodes');
      const topNodesData = await topNodesResponse.json();
      setTopNodes(topNodesData.data);

      setError(null);
    } catch (err) {
      console.error('Error loading reputation data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTrustLevelColor = (level) => {
    const colors = {
      novice: 'bg-gray-500',
      trusted: 'bg-blue-500',
      expert: 'bg-green-500'
    };
    return colors[level] || 'bg-gray-500';
  };

  const getTrustLevelText = (level) => {
    const texts = {
      novice: 'Новичок',
      trusted: 'Доверенный',
      expert: 'Эксперт'
    };
    return texts[level] || level;
  };

  const formatUptime = (lastActive) => {
    const now = new Date();
    const lastActiveDate = new Date(lastActive);
    const diffMs = now - lastActiveDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Онлайн';
    if (diffHours < 24) return `${diffHours}ч назад`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}д назад`;
  };

  if (loading && !reputationStats) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Ошибка загрузки</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={loadReputationData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Репутация узлов</h1>
        <button 
          onClick={loadReputationData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
          disabled={loading}
        >
          <Activity className="w-4 h-4" />
          <span>{loading ? 'Обновляется...' : 'Обновить'}</span>
        </button>
      </div>

      {/* Stats Cards */}
      {reputationStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего узлов</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reputationStats.totalNodes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Средняя репутация</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reputationStats.averageReputation.toFixed(1)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Экспертов</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {reputationStats.trustLevelDistribution.expert}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Доверенных</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {reputationStats.trustLevelDistribution.trusted}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Nodes Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <span>Топ узлы по репутации</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topNodes.map((node, index) => (
              <div 
                key={node.nodeId} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-bold">
                    {index + 1}
                  </div>

                  {/* Node Info */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-gray-900">
                        {node.nodeId.substring(0, 12)}...
                      </span>
                      <Badge className={`${getTrustLevelColor(node.level)} text-white`}>
                        {getTrustLevelText(node.level)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>{(node.successRate * 100).toFixed(1)}% успех</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Activity className="w-3 h-3" />
                        <span>{node.totalTasks} задач</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatUptime(node.lastActive)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reputation Score */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {node.reputation}
                  </div>
                  <div className="text-sm text-gray-500">репутация</div>
                  
                  {/* Reputation Progress Bar */}
                  <div className="mt-2 w-32">
                    <Progress 
                      value={(node.reputation / 1000) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {topNodes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Нет данных о узлах</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trust Level Distribution */}
      {reputationStats && (
        <Card>
          <CardHeader>
            <CardTitle>Распределение уровней доверия</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(reputationStats.trustLevelDistribution).map(([level, count]) => {
                const total = reputationStats.totalNodes;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={level} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded ${getTrustLevelColor(level)}`}></div>
                      <span className="font-medium">{getTrustLevelText(level)}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Progress value={percentage} className="w-24 h-2" />
                      <span className="text-sm text-gray-600 w-12">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NodeReputationDashboard;