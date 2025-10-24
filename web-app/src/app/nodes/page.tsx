'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Server, 
  Activity, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Eye,
  Play,
  Pause,
  Settings,
  MapPin,
  Zap
} from 'lucide-react'

// Mock data
const mockNodes = [
  {
    id: 'node_001',
    name: 'Node Alpha',
    status: 'online',
    location: 'San Francisco, CA',
    owner: 'you',
    specs: {
      cpu: 'AMD Ryzen 9 5950X',
      gpu: 'NVIDIA RTX 4090',
      ram: '64 GB',
      storage: '2 TB NVMe'
    },
    performance: {
      cpuUsage: 45,
      memoryUsage: 67,
      gpuUsage: 23,
      storageUsage: 34
    },
    earnings: {
      today: 12.45,
      total: 1234.56,
      tasks: 156
    },
    uptime: 99.8,
    lastSeen: '2024-01-15T12:00:00Z'
  },
  {
    id: 'node_002',
    name: 'Node Beta',
    status: 'busy',
    location: 'New York, NY',
    owner: 'network',
    specs: {
      cpu: 'Intel i9-13900K',
      gpu: 'NVIDIA RTX 4080',
      ram: '32 GB',
      storage: '1 TB NVMe'
    },
    performance: {
      cpuUsage: 89,
      memoryUsage: 78,
      gpuUsage: 95,
      storageUsage: 45
    },
    earnings: {
      today: 8.90,
      total: 890.34,
      tasks: 89
    },
    uptime: 97.5,
    lastSeen: '2024-01-15T11:58:00Z'
  },
  {
    id: 'node_003',
    name: 'Node Gamma',
    status: 'offline',
    location: 'London, UK',
    owner: 'network',
    specs: {
      cpu: 'AMD Ryzen 7 5800X',
      gpu: 'NVIDIA RTX 3080',
      ram: '32 GB',
      storage: '512 GB NVMe'
    },
    performance: {
      cpuUsage: 0,
      memoryUsage: 0,
      gpuUsage: 0,
      storageUsage: 67
    },
    earnings: {
      today: 0,
      total: 567.89,
      tasks: 45
    },
    uptime: 85.2,
    lastSeen: '2024-01-15T09:30:00Z'
  }
]

export default function NodesPage() {
  const [filter, setFilter] = useState<'all' | 'your' | 'network'>('all')
  const [search, setSearch] = useState('')

  const filteredNodes = mockNodes.filter(node => {
    const matchesFilter = filter === 'all' || 
      (filter === 'your' && node.owner === 'you') ||
      (filter === 'network' && node.owner === 'network')
    
    const matchesSearch = node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.location.toLowerCase().includes(search.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  const getStatusBadge = (status: string) => {
    const variants = {
      online: 'success',
      busy: 'warning',
      offline: 'destructive'
    } as const

    const labels = {
      online: 'Online',
      busy: 'Busy',
      offline: 'Offline'
    }

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    )
  }

  const getPerformanceColor = (usage: number) => {
    if (usage < 50) return 'text-green-500'
    if (usage < 80) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
          <p className="text-muted-foreground">
            Monitor and manage compute nodes in the NeuroGrid network
          </p>
        </div>
        <Button>
          <Server className="mr-2 h-4 w-4" />
          Add Node
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All Nodes
          </Button>
          <Button 
            variant={filter === 'your' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('your')}
          >
            Your Nodes
          </Button>
          <Button 
            variant={filter === 'network' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('network')}
          >
            Network Nodes
          </Button>
        </div>
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Network Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockNodes.length}</div>
            <p className="text-xs text-muted-foreground">
              {mockNodes.filter(n => n.status === 'online').length} online
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Nodes</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockNodes.filter(n => n.owner === 'you').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Earning ${mockNodes.filter(n => n.owner === 'you').reduce((sum, n) => sum + n.earnings.today, 0).toFixed(2)}/day
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Load</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">67%</div>
            <p className="text-xs text-muted-foreground">
              Average utilization
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground">
              Network average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Nodes List */}
      <div className="space-y-4">
        {filteredNodes.map((node) => (
          <Card key={node.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-4 flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-lg">{node.name}</h3>
                        {getStatusBadge(node.status)}
                        {node.owner === 'you' && (
                          <Badge variant="outline">Your Node</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{node.location}</span>
                        <span>•</span>
                        <span>Uptime: {node.uptime}%</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {node.status === 'online' && (
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {node.status === 'offline' && (
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Specs and Performance Grid */}
                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Specifications */}
                    <div>
                      <h4 className="font-medium mb-2">Specifications</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-3 w-3 text-muted-foreground" />
                          <span>{node.specs.cpu}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <span>{node.specs.gpu}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Activity className="h-3 w-3 text-muted-foreground" />
                          <span>{node.specs.ram} RAM</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <HardDrive className="h-3 w-3 text-muted-foreground" />
                          <span>{node.specs.storage}</span>
                        </div>
                      </div>
                    </div>

                    {/* Performance */}
                    <div>
                      <h4 className="font-medium mb-2">Performance</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>CPU</span>
                          <span className={getPerformanceColor(node.performance.cpuUsage)}>
                            {node.performance.cpuUsage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full"
                            style={{ width: `${node.performance.cpuUsage}%` }}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span>Memory</span>
                          <span className={getPerformanceColor(node.performance.memoryUsage)}>
                            {node.performance.memoryUsage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-green-600 h-1 rounded-full"
                            style={{ width: `${node.performance.memoryUsage}%` }}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span>GPU</span>
                          <span className={getPerformanceColor(node.performance.gpuUsage)}>
                            {node.performance.gpuUsage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-purple-600 h-1 rounded-full"
                            style={{ width: `${node.performance.gpuUsage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Earnings */}
                    <div>
                      <h4 className="font-medium mb-2">Earnings</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Today:</span>
                          <span className="font-medium">${node.earnings.today}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-medium">${node.earnings.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tasks:</span>
                          <span className="font-medium">{node.earnings.tasks}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Last seen:</span>
                          <span>{new Date(node.lastSeen).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No nodes found</h3>
            <p className="text-muted-foreground mb-4">
              {filter === 'your' 
                ? "You don't have any nodes yet. Add a node to start earning rewards."
                : "No nodes match your search criteria."
              }
            </p>
            {filter === 'your' && (
              <Button>
                <Server className="mr-2 h-4 w-4" />
                Add Your First Node
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}