'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Zap, 
  Clock, 
  Upload, 
  Play, 
  Pause, 
  Square, 
  Download,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'

// Mock data
const mockTasks = [
  {
    id: 'task_001',
    name: 'Sci-fi Landscape Generation',
    model: 'Stable Diffusion XL',
    status: 'completed',
    priority: 'high',
    createdAt: '2024-01-15T10:30:00Z',
    completedAt: '2024-01-15T10:31:23Z',
    duration: 83,
    cost: 0.45,
    result: 'https://example.com/result.jpg'
  },
  {
    id: 'task_002',
    name: 'Code Review Assistant',
    model: 'CodeLLaMA 34B',
    status: 'running',
    priority: 'normal',
    createdAt: '2024-01-15T11:15:00Z',
    progress: 67,
    cost: 0.23
  },
  {
    id: 'task_003',
    name: 'Meeting Transcription',
    model: 'Whisper Large v3',
    status: 'pending',
    priority: 'low',
    createdAt: '2024-01-15T11:30:00Z',
    cost: 0.12
  },
  {
    id: 'task_004',
    name: 'Document Summarization',
    model: 'LLaMA 2 70B',
    status: 'failed',
    priority: 'normal',
    createdAt: '2024-01-15T09:45:00Z',
    error: 'Input text too long',
    cost: 0.15
  }
]

interface TaskFormData {
  name: string
  model: string
  type: string
  priority: string
  input: string
  parameters: string
}

const models = [
  { id: 'stable-diffusion-xl', name: 'Stable Diffusion XL', type: 'image', cost: 0.04 },
  { id: 'llama-2-70b', name: 'LLaMA 2 70B', type: 'text', cost: 0.02 },
  { id: 'codellama-34b', name: 'CodeLLaMA 34B', type: 'text', cost: 0.03 },
  { id: 'whisper-large-v3', name: 'Whisper Large v3', type: 'audio', cost: 0.01 },
  { id: 'gpt-4-vision', name: 'GPT-4 Vision', type: 'multimodal', cost: 0.06 }
]

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list')
  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    model: '',
    type: 'text',
    priority: 'normal',
    input: '',
    parameters: '{}'
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
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

  const getPriorityBadge = (priority: string) => {
    const variants = {
      high: 'destructive',
      normal: 'secondary',
      low: 'outline'
    } as const

    return (
      <Badge variant={variants[priority as keyof typeof variants] || 'secondary'}>
        {priority}
      </Badge>
    )
  }

  const handleInputChange = (field: keyof TaskFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle task submission
    console.log('Submitting task:', formData)
    // Reset form
    setFormData({
      name: '',
      model: '',
      type: 'text',
      priority: 'normal',
      input: '',
      parameters: '{}'
    })
    setActiveTab('list')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Submit and manage your AI inference tasks
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={activeTab === 'list' ? 'default' : 'outline'}
            onClick={() => setActiveTab('list')}
          >
            Task List
          </Button>
          <Button 
            variant={activeTab === 'create' ? 'default' : 'outline'}
            onClick={() => setActiveTab('create')}
          >
            <Zap className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {activeTab === 'list' ? (
        /* Task List */
        <div className="space-y-4">
          {mockTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(task.status)}
                      <h3 className="font-semibold">{task.name}</h3>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Model: {task.model} • Cost: ${task.cost}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(task.createdAt).toLocaleString()}
                    </p>
                    {task.status === 'running' && task.progress && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                    {task.error && (
                      <p className="text-sm text-red-600">Error: {task.error}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {task.status === 'running' && (
                      <>
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Square className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {task.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                    {task.status === 'failed' && (
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Task Creation Form */
        <Card>
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
            <CardDescription>
              Submit a new AI inference task to the NeuroGrid network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task Name</label>
                  <Input
                    placeholder="Enter task name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Select value={formData.model} onValueChange={(value) => handleInputChange('model', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name} - ${model.cost}/task ({model.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Input Data</label>
                <Textarea
                  placeholder="Enter your input data or prompt"
                  value={formData.input}
                  onChange={(e) => handleInputChange('input', e.target.value)}
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Parameters (JSON)</label>
                <Textarea
                  placeholder='{"temperature": 0.7, "max_tokens": 100}'
                  value={formData.parameters}
                  onChange={(e) => handleInputChange('parameters', e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Optional model-specific parameters in JSON format
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <Button type="submit" className="flex-1">
                  <Zap className="mr-2 h-4 w-4" />
                  Submit Task
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setActiveTab('list')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}