# Contributing to NeuroGrid

First, thank you for your interest in contributing to NeuroGrid! 🎉

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18.x+ 
- Git
- Docker (optional, for testing)

### Development Setup
```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/neurogrid.git
cd neurogrid

# 3. Install dependencies
npm install
cd coordinator-server && npm install && cd ..

# 4. Setup environment
cp .env.example .env
# Edit .env with development values

# 5. Run tests to ensure everything works
npm test
```

## 🏗️ Project Structure

```
neurogrid/
├── coordinator-server/     # Main API server
├── web-interface/          # Frontend UI
├── src/                   # Shared utilities
│   ├── ai/               # AI model management
│   ├── phase4/           # DeFi integration
│   └── utils/            # Common utilities
├── tests/                # Test suites
├── docs/                 # Documentation
└── scripts/              # Utility scripts
```

## 🎯 Ways to Contribute

### 🐛 Bug Reports
- Use GitHub Issues
- Include reproduction steps
- Provide system information
- Check for existing issues first

### ✨ Feature Requests
- Discuss in GitHub Discussions first
- Provide detailed use cases
- Consider implementation complexity

### 💻 Code Contributions

#### Areas that need help:
1. **AI Model Integration** - Adding support for new models
2. **GPU Node Management** - Improving node discovery and load balancing
3. **Frontend Components** - React/Vue components for the dashboard
4. **Testing** - Unit tests, integration tests, E2E tests
5. **Documentation** - API docs, tutorials, examples

## 📝 Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Development Guidelines

#### Code Style
- Use ESLint configuration (npm run lint)
- Follow Prettier formatting (npm run format)
- Write descriptive commit messages

#### Commit Message Format
```
type(scope): description

Examples:
feat(api): add new endpoint for model status
fix(auth): resolve JWT token validation issue
docs(readme): update deployment instructions
test(api): add integration tests for /nodes endpoint
```

#### API Development
- All endpoints must have proper error handling
- Include OpenAPI/Swagger documentation
- Add rate limiting where appropriate
- Write tests for new endpoints

```javascript
// Example endpoint structure
router.get('/api/models', authenticate, async (req, res) => {
  try {
    const models = await modelService.getAvailable();
    res.json({
      success: true,
      data: models,
      message: 'Models retrieved successfully'
    });
  } catch (error) {
    logger.error('Failed to get models', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### 3. Testing Requirements

#### Before submitting:
```bash
# Run all tests
npm test
cd coordinator-server && npm test

# Check code coverage (aim for 80%+)
npm run test:coverage

# Lint your code
npm run lint

# Format code
npm run format
```

#### Writing Tests
- Unit tests for utilities and services
- Integration tests for API endpoints
- E2E tests for critical user flows

```javascript
// Example test
describe('Model Service', () => {
  test('should return available models', async () => {
    const models = await modelService.getAvailable();
    expect(models).toBeArray();
    expect(models.length).toBeGreaterThan(0);
  });
});
```

### 4. Pull Request Process

#### PR Checklist:
- [ ] Tests pass locally
- [ ] Code is linted and formatted
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG.md updated (for significant changes)
- [ ] Screenshots included (for UI changes)

#### PR Description Template:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)

## Additional Notes
```

## 🏷️ Issue Labels

We use these labels to categorize issues:

- `good first issue` - Perfect for newcomers
- `help wanted` - We need community help
- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Documentation needed
- `priority:high` - Urgent issues
- `area:api` - API related
- `area:frontend` - UI/Frontend related
- `area:ai` - AI model integration
- `area:defi` - DeFi/blockchain related

## 🔒 Security

If you discover a security vulnerability, please email security@neurogrid.ai instead of opening a public issue.

## 📚 Resources

- [API Documentation](./docs/api/)
- [Architecture Overview](./docs/architecture/)
- [Development Guide](./docs/development/)
- [Deployment Guide](./docs/PRODUCTION.md)

## 💬 Community

- GitHub Discussions: Questions and ideas
- Discord: Real-time chat (coming soon)
- Twitter: [@NeuroGridAI](https://twitter.com/NeuroGridAI)

## 🎉 Recognition

Contributors will be:
- Added to our README contributors section
- Mentioned in release notes
- Invited to our contributor Discord channel
- Eligible for contributor rewards (tokens/NFTs)

Thank you for helping make NeuroGrid better! 🚀