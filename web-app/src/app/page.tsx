'use client'

import { useEffect, useState } from 'react'
import { DashboardStats, RecentTasks, SystemHealth } from '@/components/dashboard/dashboard-components'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, Server, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

// Mock data - In real app, this would come from API
const mockStats = {
  totalTasks: 12847,
  activeTasks: 23,
  completedTasks: 12456,
  failedTasks: 391,
  totalNodes: 156,
  activeNodes: 142,
  totalEarnings: 2847.32,
  pendingPayouts: 156.78
}

const mockRecentTasks = [
  {
    id: '1',
    name: 'Image Generation: Sci-fi Landscape',
    status: 'completed' as const,
    model: 'Stable Diffusion XL',
    createdAt: '2024-01-15T10:30:00Z',
    duration: 45
  },
  {
    id: '2',
    name: 'Text Generation: Article Summary',
    status: 'running' as const,
    model: 'LLaMA 2 70B',
    createdAt: '2024-01-15T11:15:00Z'
  },
  {
    id: '3',
    name: 'Audio Transcription: Meeting Notes',
    status: 'completed' as const,
    model: 'Whisper Large',
    createdAt: '2024-01-15T09:45:00Z',
    duration: 23
  },
  {
    id: '4',
    name: 'Code Generation: API Endpoint',
    status: 'failed' as const,
    model: 'CodeLLaMA',
    createdAt: '2024-01-15T08:20:00Z'
  },
  {
    id: '5',
    name: 'Image Analysis: Object Detection',
    status: 'pending' as const,
    model: 'YOLO v8',
    createdAt: '2024-01-15T11:30:00Z'
  }
]

const mockSystemHealth = {
  overall: 'healthy' as const,
  uptime: '99.8%',
  responseTime: 145,
  errorRate: 0.2,
  activeConnections: 1247
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your NeuroGrid activity.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/tasks/new">
              <Zap className="mr-2 h-4 w-4" />
              Submit Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <DashboardStats stats={mockStats} />

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Tasks */}
        <div className="lg:col-span-2">
          <RecentTasks tasks={mockRecentTasks} />
        </div>

        {/* System Health */}
        <div>
          <SystemHealth health={mockSystemHealth} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Node Network</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {mockStats.activeNodes} nodes are currently online and processing tasks
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/nodes">View Network</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Analytics</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Detailed insights into network performance and earnings
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/analytics">View Analytics</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">System Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              2 maintenance notifications and 1 performance alert
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/notifications">View Alerts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Network Status Banner */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-800">
              All systems operational
            </span>
            <Badge variant="success" className="ml-auto">
              99.8% uptime
            </Badge>
          </div>
          <p className="text-sm text-green-700 mt-2">
            NeuroGrid network is running smoothly with {mockStats.activeNodes} active nodes processing tasks efficiently.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
