# Production Dockerfile for NeuroGrid Coordinator
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S neurogrid -u 1001

# Set permissions
RUN chown -R neurogrid:nodejs /app
USER neurogrid

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]

# Development Dockerfile
FROM node:18-alpine AS development

WORKDIR /app

# Install all dependencies (including dev)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Expose ports for development (app + debug)
EXPOSE 3001 9229

# Start with nodemon for development
CMD ["npm", "run", "dev"]