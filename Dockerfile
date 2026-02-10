# =============================================================================
# Smarton Backend - Production Dockerfile
# =============================================================================
# Multi-stage build for optimized NestJS production image
# 
# Build: docker build -t smarton-backend:latest .
# Run:   docker run -p 3001:3001 --env-file .env smarton-backend:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ 

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    ffmpeg \
    dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Create uploads directory
RUN mkdir -p uploads/books uploads/audio && \
    chown -R nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]

# -----------------------------------------------------------------------------
# Labels
# -----------------------------------------------------------------------------
LABEL org.opencontainers.image.title="Smarton Backend"
LABEL org.opencontainers.image.description="AI-powered audio content platform API"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Sunbots"
