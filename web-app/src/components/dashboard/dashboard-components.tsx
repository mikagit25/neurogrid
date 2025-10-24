'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  DollarSign, 
  Server, 
  Zap, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react'

interface DashboardStatsProps {
  stats: {
    totalTasks: number
    activeTasks: number
    completedTasks: number
    failedTasks: number
    totalNodes: number
    activeNodes: number
    totalEarnings: number
    pendingPayouts: number
  }
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks.toLocaleString(),
      description: `${stats.activeTasks} active`,
      icon: Zap,
      trend: '+12% from last month',
      color: 'text-blue-600'
    },
    {
      title: 'Active Nodes',
      value: `${stats.activeNodes}/${stats.totalNodes}`,
      description: `${Math.round((stats.activeNodes / stats.totalNodes) * 100)}% online`,
      icon: Server,
      trend: '+2 new nodes',
      color: 'text-green-600'
    },
    {
      title: 'Total Earnings',
      value: `$${stats.totalEarnings.toFixed(2)}`,
      description: `$${stats.pendingPayouts.toFixed(2)} pending`,
      icon: DollarSign,
      trend: '+8% this week',
      color: 'text-yellow-600'
    },
    {
      title: 'Success Rate',
      value: `${Math.round((stats.completedTasks / stats.totalTasks) * 100)}%`,
      description: `${stats.failedTasks} failed tasks`,
      icon: Activity,
      trend: '+2% improvement',
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-500">{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

interface RecentTasksProps {
  tasks: Array<{
    id: string
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    model: string
    createdAt: string
    duration?: number
  }>
}

export function RecentTasks({ tasks }: RecentTasksProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'success',
      running: 'info',
      failed: 'destructive',
      pending: 'warning'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Tasks</CardTitle>
        <CardDescription>
          Your latest inference tasks and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-4">
              {getStatusIcon(task.status)}
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {task.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {task.model} • {new Date(task.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {task.duration && (
                  <span className="text-sm text-muted-foreground">
                    {task.duration}s
                  </span>
                )}
                {getStatusBadge(task.status)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full">
            View All Tasks
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface SystemHealthProps {
  health: {
    overall: 'healthy' | 'warning' | 'critical'
    uptime: string
    responseTime: number
    errorRate: number
    activeConnections: number
  }
}

export function SystemHealth({ health }: SystemHealthProps) {
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'critical':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>
          Real-time status of NeuroGrid infrastructure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Status</span>
            <Badge 
              variant={health.overall === 'healthy' ? 'success' : 
                      health.overall === 'warning' ? 'warning' : 'destructive'}
            >
              {health.overall}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Uptime</span>
              <p className="font-medium">{health.uptime}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Response Time</span>
              <p className="font-medium">{health.responseTime}ms</p>
            </div>
            <div>
              <span className="text-muted-foreground">Error Rate</span>
              <p className="font-medium">{health.errorRate}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Connections</span>
              <p className="font-medium">{health.activeConnections}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}