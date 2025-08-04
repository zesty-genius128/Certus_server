# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S certus -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=certus:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=certus:nodejs . .

# Remove unnecessary files for production
RUN rm -rf \
    tests/ \
    .github/ \
    backups/ \
    fastify-tests/ \
    *.md \
    .env.example \
    .gitignore \
    .gitattributes \
    railway-deploy.json

# Switch to non-root user
USER certus

# Expose port (configurable via PORT env var)
EXPOSE 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-443}/health || exit 1

# Environment variables with defaults
ENV NODE_ENV=production
ENV PORT=443

# Start the server
CMD ["node", "official-mcp-server.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="Certus OpenFDA MCP Server"
LABEL org.opencontainers.image.description="Healthcare-focused MCP server providing FDA drug information including shortages, recalls, labels, and adverse events"
LABEL org.opencontainers.image.vendor="Certus"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/zesty-genius128/Certus_server"
LABEL org.opencontainers.image.documentation="https://github.com/zesty-genius128/Certus_server#readme"