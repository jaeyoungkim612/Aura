# Use Alpine Linux for smaller image size
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production

# Install system dependencies for Playwright
RUN apk add --no-cache \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Configure npm for faster installation
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

# Install dependencies with optimizations
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Copy application files
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "server.js"] 