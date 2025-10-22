# NeuroGrid Web Interface

React-based dashboard and monitoring interface for the NeuroGrid distributed AI inference platform.

## Features

- **Client Dashboard**: Submit tasks, monitor progress, view results
- **Node Monitoring**: Real-time node status, metrics, and performance
- **Token Management**: View balances, transaction history, rewards
- **System Analytics**: Network statistics, usage trends, health metrics
- **Task Management**: Queue status, execution history, error tracking
- **Model Explorer**: Browse available models, specifications, usage

## Architecture

```
[React App]
├── [Task Dashboard] — submit and monitor inference tasks
├── [Node Monitor] — real-time node status and metrics  
├── [Token Tracker] — balance, earnings, transactions
├── [System Analytics] — network health and statistics
├── [Model Browser] — available models and capabilities
└── [Admin Panel] — system configuration and management
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws

# Authentication
NEXT_PUBLIC_JWT_SECRET=your-jwt-secret
NEXT_PUBLIC_OAUTH_CLIENT_ID=your-oauth-client-id

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_MONITORING=true
NEXT_PUBLIC_ENABLE_ADMIN=false

# External Services
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

## User Guide

### For Task Clients

#### Submitting Tasks
1. Navigate to **Tasks** page
2. Select model type (text, image, audio)
3. Choose specific model (LLaMA, Stable Diffusion, etc.)
4. Enter input data
5. Set priority and parameters
6. Submit task and receive ID

#### Monitoring Progress
- Real-time status updates via WebSocket
- Progress indicators for long-running tasks
- Estimated completion time
- Error notifications and retry options

#### Viewing Results
- Automatic result display on completion
- Download options for files/data
- Result history and archiving
- Sharing and export features

### For Node Operators

#### Node Dashboard
- Registration status and health
- Current task execution
- Resource utilization (GPU, CPU, RAM)
- Network connectivity status
- Earnings and token balance

#### Performance Metrics
- Task completion rates
- Average execution times
- Error rates and types
- Resource efficiency scores
- Uptime and availability

#### Token Management
- Real-time balance updates
- Earnings history and projections
- Withdrawal options and limits
- Referral rewards and bonuses

### For System Administrators

#### Network Overview
- Total active nodes
- Task queue status
- System load and capacity
- Geographic distribution
- Performance statistics

#### Analytics Dashboard
- Usage trends and patterns
- Model popularity metrics
- Cost and pricing analysis
- User engagement data
- System health indicators

## Development

### Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Shadcn/ui
- **Charts**: Recharts
- **State Management**: Zustand
- **API Client**: React Query (TanStack Query)
- **Real-time**: Socket.IO client
- **Authentication**: NextAuth.js

### Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── (dashboard)/       # Dashboard layout group
│   │   ├── tasks/         # Task management pages
│   │   ├── nodes/         # Node monitoring pages
│   │   ├── tokens/        # Token management pages
│   │   └── analytics/     # Analytics pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/                # Base UI components (shadcn/ui)
│   ├── dashboard/         # Dashboard-specific components
│   ├── charts/            # Chart components
│   └── forms/             # Form components
├── lib/                   # Utility libraries
│   ├── api.ts             # API client
│   ├── auth.ts            # Authentication config
│   ├── utils.ts           # Utility functions
│   └── validations.ts     # Form validations
├── hooks/                 # Custom React hooks
│   ├── use-api.ts         # API hooks
│   ├── use-websocket.ts   # WebSocket hooks
│   └── use-auth.ts        # Authentication hooks
├── stores/                # Zustand stores
│   ├── auth.ts            # Authentication state
│   ├── tasks.ts           # Task management state
│   └── nodes.ts           # Node monitoring state
└── types/                 # TypeScript type definitions
    ├── api.ts             # API response types
    ├── tasks.ts           # Task-related types
    └── nodes.ts           # Node-related types
```

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:watch
npm run test:coverage

# Build and deployment
npm run build
npm run start
npm run export
```

### Component Development

#### Creating New Components

```bash
# Generate new component
npm run generate:component ComponentName

# Generate new page
npm run generate:page page-name
```

#### Component Guidelines

1. Use TypeScript for all components
2. Follow React best practices (hooks, functional components)
3. Use Tailwind for styling
4. Implement proper error boundaries
5. Include loading and error states
6. Write unit tests for complex logic

### API Integration

#### REST API Client

```typescript
// lib/api.ts
import { createApiClient } from './api-client';

const api = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
});

export const tasksApi = {
  submit: (task: TaskSubmission) => api.post('/tasks', task),
  getStatus: (id: string) => api.get(`/tasks/${id}`),
  getResult: (id: string) => api.get(`/tasks/${id}/result`),
};
```

#### WebSocket Integration

```typescript
// hooks/use-websocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(url);
    setSocket(socketInstance);

    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));

    return () => socketInstance.close();
  }, [url]);

  return { socket, connected };
}
```

### State Management

#### Zustand Store Example

```typescript
// stores/tasks.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  submitTask: (task: TaskSubmission) => Promise<void>;
  fetchTasks: () => Promise<void>;
}

export const useTasksStore = create<TasksState>()(
  devtools((set, get) => ({
    tasks: [],
    loading: false,
    error: null,
    
    submitTask: async (task) => {
      set({ loading: true, error: null });
      try {
        const result = await tasksApi.submit(task);
        set((state) => ({ 
          tasks: [...state.tasks, result],
          loading: false 
        }));
      } catch (error) {
        set({ error: error.message, loading: false });
      }
    },
    
    fetchTasks: async () => {
      // Implementation
    },
  }))
);
```

### Testing

#### Unit Tests

```typescript
// __tests__/components/TaskForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskForm } from '@/components/forms/TaskForm';

describe('TaskForm', () => {
  it('submits task with correct data', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'llama2' }
    });
    
    fireEvent.click(screen.getByText('Submit Task'));
    
    expect(onSubmit).toHaveBeenCalledWith({
      model: 'llama2',
      // ... other fields
    });
  });
});
```

#### Integration Tests

```typescript
// __tests__/pages/tasks.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TasksPage from '@/app/(dashboard)/tasks/page';

describe('Tasks Page', () => {
  it('displays tasks list', async () => {
    const queryClient = new QueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <TasksPage />
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Recent Tasks')).toBeInTheDocument();
    });
  });
});
```

## Deployment

### Production Build

```bash
# Build optimized production bundle
npm run build

# Test production build locally
npm start
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.neurogrid.ai
NEXT_PUBLIC_WS_URL=wss://api.neurogrid.ai/ws
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://app.neurogrid.ai
```

### Performance Optimization

1. **Image Optimization**: Next.js Image component with WebP
2. **Code Splitting**: Automatic route-based splitting
3. **Bundle Analysis**: `npm run analyze` to check bundle size
4. **Caching**: Static generation and ISR where possible
5. **CDN**: Deploy static assets to CDN

## Contributing

### Development Setup

1. Fork the repository
2. Create feature branch
3. Install dependencies: `npm install`
4. Start development server: `npm run dev`
5. Make changes and test
6. Submit pull request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb config with React hooks
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for linting/testing
- **Conventional Commits**: Standardized commit messages

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add screenshot for UI changes
4. Request review from maintainers
5. Address feedback and rebase if needed

## License

MIT License - see [LICENSE](../LICENSE) for details.