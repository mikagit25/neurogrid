#!/bin/bash

# NeuroGrid Documentation Automation Script

echo "🚀 Starting NeuroGrid Documentation Automation..."

# Install dependencies
echo "📦 Installing documentation dependencies..."
npm install -g @apidevtools/swagger-parser
npm install --save-dev @apidevtools/swagger-cli

# Validate OpenAPI specification
echo "✅ Validating OpenAPI specification..."
swagger-parser validate docs/api/openapi.yaml

# Generate documentation
echo "📚 Generating API documentation..."
npx swagger-codegen generate -i docs/api/openapi.yaml -l html2 -o docs/generated/

# Test API endpoints
echo "🧪 Testing API endpoints..."
npm test

# Update documentation timestamp
echo "📅 Updating documentation timestamp..."
echo "Last updated: $(date)" > docs/api/last-updated.txt

echo "✅ Documentation automation completed!"
echo "📖 View docs at: http://localhost:3001/api-docs"