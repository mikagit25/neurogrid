#!/bin/bash

# NeuroGrid Testing Setup Script
# Sets up the testing environment and runs tests

set -e

echo "🧪 Setting up NeuroGrid Testing Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the coordinator-server directory."
    exit 1
fi

# Load test environment
if [ -f ".env.test" ]; then
    print_status "Loading test environment configuration..."
    export $(cat .env.test | grep -v '^#' | xargs)
else
    print_warning ".env.test not found, using default test configuration"
fi

# Function to check if PostgreSQL is running
check_postgres() {
    if command -v pg_isready > /dev/null 2>&1; then
        if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to setup test database
setup_test_db() {
    print_status "Setting up test database..."
    
    if check_postgres; then
        print_status "PostgreSQL is running, setting up test database..."
        
        # Create test database user and database
        psql -h localhost -U postgres -c "CREATE USER test_user WITH PASSWORD 'test_pass';" 2>/dev/null || true
        psql -h localhost -U postgres -c "CREATE DATABASE test_neurogrid OWNER test_user;" 2>/dev/null || true
        psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE test_neurogrid TO test_user;" 2>/dev/null || true
        
        print_success "Test database setup complete"
    else
        print_warning "PostgreSQL not available. Tests will use SQLite fallback."
        export DATABASE_URL="sqlite::memory:"
    fi
}

# Function to run specific test suite
run_tests() {
    local test_type=${1:-"all"}
    
    print_status "Running $test_type tests..."
    
    case $test_type in
        "unit")
            npm run test:unit
            ;;
        "integration")
            npm run test:integration
            ;;
        "e2e")
            npm run test:e2e
            ;;
        "coverage")
            npm run test:coverage
            ;;
        "ci")
            npm run test:ci
            ;;
        "all"|*)
            npm run test:all
            ;;
    esac
}

# Function to generate test report
generate_report() {
    print_status "Generating test report..."
    
    if [ -d "coverage" ]; then
        print_success "Coverage report generated in coverage/ directory"
        
        # Display coverage summary
        if [ -f "coverage/lcov-report/index.html" ]; then
            print_status "HTML coverage report: coverage/lcov-report/index.html"
        fi
        
        # Show coverage summary
        if [ -f "coverage/coverage-summary.json" ]; then
            echo "📊 Coverage Summary:"
            node -e "
                const summary = require('./coverage/coverage-summary.json');
                console.log('Lines:', summary.total.lines.pct + '%');
                console.log('Functions:', summary.total.functions.pct + '%');
                console.log('Branches:', summary.total.branches.pct + '%');
                console.log('Statements:', summary.total.statements.pct + '%');
            " 2>/dev/null || echo "Coverage summary not available"
        fi
    fi
}

# Function to cleanup test environment
cleanup() {
    print_status "Cleaning up test environment..."
    
    # Remove test uploads directory
    if [ -d "test-uploads" ]; then
        rm -rf test-uploads
        print_status "Removed test uploads directory"
    fi
    
    # Remove test logs
    if [ -d "test-logs" ]; then
        rm -rf test-logs
        print_status "Removed test logs directory"
    fi
    
    print_success "Cleanup complete"
}

# Main execution
main() {
    local command=${1:-"all"}
    
    case $command in
        "setup")
            setup_test_db
            ;;
        "unit"|"integration"|"e2e"|"coverage"|"ci"|"all")
            setup_test_db
            run_tests $command
            generate_report
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  setup       Setup test database only"
            echo "  unit        Run unit tests"
            echo "  integration Run integration tests"
            echo "  e2e         Run end-to-end tests"
            echo "  coverage    Run tests with coverage report"
            echo "  ci          Run tests in CI mode"
            echo "  all         Run all tests (default)"
            echo "  cleanup     Clean up test artifacts"
            echo "  help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Run all tests"
            echo "  $0 unit         # Run only unit tests"
            echo "  $0 coverage     # Run tests with coverage"
            echo "  $0 cleanup      # Clean up test files"
            exit 0
            ;;
        *)
            print_error "Unknown command: $command"
            print_status "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap cleanup EXIT

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Run main function
main "$@"

print_success "🎉 Testing complete!"

echo ""
echo "📋 Test Results Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Unit Tests: Testing individual components and services"
echo "✅ Integration Tests: Testing API endpoints and workflows"  
echo "✅ E2E Tests: Testing complete user journeys"
echo "📊 Coverage Report: Available in coverage/ directory"
echo ""
echo "Next steps:"
echo "1. 📖 Review test results and coverage report"
echo "2. 🐛 Fix any failing tests if needed"
echo "3. 📈 Improve test coverage for uncovered code"
echo "4. 🚀 Set up CI/CD pipeline for automated testing"