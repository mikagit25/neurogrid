import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Zap, 
  Users, 
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Eye,
  Activity,
  Brain,
  Code,
  BarChart,
  Image,
  FileText
} from 'lucide-react';

const AgentSwarmDashboard = () => {
  const [taskDescription, setTaskDescription] = useState('');
  const [taskType, setTaskType] = useState('general');
  const [agentTypes, setAgentTypes] = useState([]);
  const [swarmStats, setSwarmStats] = useState(null);
  const [currentTask, setCurrentTask] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAgentTypes();
    loadSwarmStats();
    const interval = setInterval(loadSwarmStats, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAgentTypes = async () => {
    try {
      const response = await fetch('/api/agents/types');
      if (!response.ok) throw new Error('Failed to load agent types');
      const data = await response.json();
      setAgentTypes(data.data.agentTypes);
    } catch (err) {
      console.error('Error loading agent types:', err);
    }
  };

  const loadSwarmStats = async () => {
    try {
      const response = await fetch('/api/agents/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();
      setSwarmStats(data.data);
    } catch (err) {
      console.error('Error loading swarm stats:', err);
    }
  };

  const executeSwarmTask = async () => {
    if (!taskDescription.trim()) {
      setError('Пожалуйста, опишите задачу');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentTask({ status: 'processing', description: taskDescription });

    try {
      const response = await fetch('/api/agents/swarm-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: taskDescription,
          type: taskType,
          requirements: {
            includeCode: taskType === 'development',
            includeAnalytics: taskType === 'analysis',
            includeVisuals: taskType === 'creative'
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        const task = {
          id: data.data.taskId,
          description: taskDescription,
          type: taskType,
          result: data.data.result,
          metadata: data.data.metadata,
          status: 'completed',
          timestamp: new Date()
        };

        setCurrentTask(task);
        setTaskHistory(prev => [task, ...prev.slice(0, 9)]); // Keep last 10
        setTaskDescription('');
      } else {
        throw new Error(data.error);
      }

    } catch (err) {
      setError(err.message);
      setCurrentTask({ status: 'error', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getAgentIcon = (agentType) => {
    const icons = {
      coordinator: Brain,
      textAgent: FileText,
      codeAgent: Code,
      dataAgent: BarChart,
      imageAgent: Image,
      aggregator: Zap
    };
    return icons[agentType] || Bot;
  };

  const getAgentColor = (agentType) => {
    const colors = {
      coordinator: 'bg-purple-100 text-purple-800',
      textAgent: 'bg-blue-100 text-blue-800',
      codeAgent: 'bg-green-100 text-green-800',
      dataAgent: 'bg-orange-100 text-orange-800',
      imageAgent: 'bg-pink-100 text-pink-800',
      aggregator: 'bg-yellow-100 text-yellow-800'
    };
    return colors[agentType] || 'bg-gray-100 text-gray-800';
  };

  const taskTypeOptions = [
    { value: 'general', label: 'Общая задача' },
    { value: 'development', label: 'Разработка' },
    { value: 'analysis', label: 'Анализ данных' },
    { value: 'creative', label: 'Творческая работа' },
    { value: 'business', label: 'Бизнес планирование' },
    { value: 'research', label: 'Исследование' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Agent Swarm</h1>
          <p className="text-gray-600">Координация роя ИИ-агентов для сложных задач</p>
        </div>
        <Badge className="bg-green-100 text-green-800 text-lg px-4 py-2">
          <Activity className="w-4 h-4 mr-2" />
          {swarmStats?.activeAgents || 0} активных
        </Badge>
      </div>

      {/* Swarm Stats */}
      {swarmStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Активные агенты</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{swarmStats.activeAgents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Завершено задач</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{swarmStats.completedTasks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Типы агентов</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{swarmStats.agentTypes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Среднее время</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(swarmStats.averageProcessingTime / 1000)}с
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Task Execution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <span>Запуск задачи для роя агентов</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Тип задачи</label>
            <select 
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {taskTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Описание задачи</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Опишите сложную задачу, которую нужно решить используя рой ИИ-агентов..."
              className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none"
              disabled={loading}
            />
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={executeSwarmTask}
            disabled={loading || !taskDescription.trim()}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? 'Обработка роем агентов...' : 'Запустить рой агентов'}
          </Button>
        </CardContent>
      </Card>

      {/* Current Task Status */}
      {currentTask && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5" />
              <span>Текущая задача</span>
              {currentTask.status === 'processing' && (
                <Badge className="bg-blue-100 text-blue-800">Обработка</Badge>
              )}
              {currentTask.status === 'completed' && (
                <Badge className="bg-green-100 text-green-800">Завершена</Badge>
              )}
              {currentTask.status === 'error' && (
                <Badge className="bg-red-100 text-red-800">Ошибка</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentTask.status === 'processing' && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Агенты работают над задачей...</span>
              </div>
            )}

            {currentTask.status === 'completed' && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Результат:</h4>
                  <p className="text-gray-800 whitespace-pre-wrap">{currentTask.result}</p>
                </div>

                {currentTask.metadata && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Время обработки:</span>
                      <div className="font-semibold">{currentTask.metadata.processingTime}мс</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Использованы агенты:</span>
                      <div className="font-semibold">{currentTask.metadata.agentsUsed?.length || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Качество:</span>
                      <div className="font-semibold">{Math.round((currentTask.metadata.quality || 0) * 100)}%</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Сложность:</span>
                      <div className="font-semibold">{currentTask.metadata.taskBreakdown ? 'Высокая' : 'Средняя'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentTask.status === 'error' && (
              <div className="text-red-600">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                {currentTask.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Доступные агенты</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentTypes.map((agent) => {
              const IconComponent = getAgentIcon(agent.id);
              
              return (
                <div key={agent.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${getAgentColor(agent.id)}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <p className="text-sm text-gray-500">{agent.model}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">{agent.specialization}</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline" className="text-xs">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Task History */}
      {taskHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>История задач</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {taskHistory.map((task, index) => (
                <div key={task.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{task.description.substring(0, 100)}...</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>{task.type}</span>
                        <span>{task.timestamp.toLocaleTimeString()}</span>
                        {task.metadata && (
                          <span>{Math.round(task.metadata.processingTime / 1000)}с</span>
                        )}
                      </div>
                    </div>
                    <Badge className={task.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {task.status === 'completed' ? 'Завершена' : 'Ошибка'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgentSwarmDashboard;