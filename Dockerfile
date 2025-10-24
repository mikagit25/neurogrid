# Multi-stage Dockerfile for NeuroGrid Coordinator Server Production Deployment
FROM node:18-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    dumb-init \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S neurogrid && \
    adduser -S neurogrid -u 1001 -G neurogrid

# Development stage
FROM base AS development

# Install all dependencies (including devDependencies)
COPY coordinator-server/package*.json ./
RUN npm ci --include=dev && npm cache clean --force

# Copy source code
COPY coordinator-server/ .

# Change ownership to neurogrid user
RUN chown -R neurogrid:neurogrid /usr/src/app

USER neurogrid

# Expose port
EXPOSE 3001

# Start in development mode
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build

# Install only production dependencies
COPY coordinator-server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY coordinator-server/ .

# Build production assets (if any)
RUN npm run build --if-present

# Remove development files
RUN rm -rf tests/ docs/ *.md .git* .eslint* .prettier*

# Production stage
FROM node:18-alpine AS production

# Install production system dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S neurogrid && \
    adduser -S neurogrid -u 1001 -G neurogrid

# Set working directory
WORKDIR /usr/src/app

# Copy production build from build stage
COPY --from=build --chown=neurogrid:neurogrid /usr/src/app .

# Create necessary directories
RUN mkdir -p logs tmp uploads && \
    chown -R neurogrid:neurogrid logs tmp uploads

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER neurogrid

# Expose port
EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]

# Multi-platform support labels
LABEL maintainer="NeuroGrid Team <team@neurogrid.network>"
LABEL version="2.0.0"
LABEL description="NeuroGrid Coordinator Server - Production Ready"
LABEL org.opencontainers.image.title="NeuroGrid Coordinator"
LABEL org.opencontainers.image.description="Production-ready coordinator server for NeuroGrid MainNet"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.vendor="NeuroGrid"
LABEL org.opencontainers.image.licenses="MIT"