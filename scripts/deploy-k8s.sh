#!/bin/bash

# NeuroGrid Kubernetes Deployment Script

set -e

echo "☸️  Starting NeuroGrid Kubernetes Deployment..."

# Check if kubectl is installed
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is required but not installed. Aborting." >&2; exit 1; }

# Create namespace
kubectl create namespace neurogrid --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets
echo "🔐 Creating secrets..."
kubectl create secret generic neurogrid-secrets \
  --from-literal=database-url="postgresql://neurogrid:neurogrid123@postgres:5432/neurogrid" \
  --from-literal=redis-url="redis://redis:6379" \
  --from-literal=jwt-secret="your-super-secret-jwt-key" \
  --namespace=neurogrid \
  --dry-run=client -o yaml | kubectl apply -f -

# Apply configurations
echo "📄 Applying Kubernetes configurations..."
kubectl apply -f k8s/ -n neurogrid

# Wait for deployments
echo "⏳ Waiting for deployments..."
kubectl wait --for=condition=available --timeout=300s deployment/neurogrid-coordinator -n neurogrid
kubectl wait --for=condition=available --timeout=300s deployment/neurogrid-web -n neurogrid

# Display status
echo ""
echo "🎉 NeuroGrid Kubernetes deployment completed!"
echo ""
echo "📋 Services:"
kubectl get services -n neurogrid

echo ""
echo "📱 Pods:"
kubectl get pods -n neurogrid

echo ""
echo "🔍 Access the application:"
echo "   kubectl port-forward service/neurogrid-coordinator 3001:3001 -n neurogrid"
echo "   kubectl port-forward service/neurogrid-web 3000:3000 -n neurogrid"