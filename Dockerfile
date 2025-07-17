# Use Ubuntu instead of Alpine for Playwright compatibility
FROM node:18-slim

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

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

# Install Playwright system dependencies as root
RUN npx playwright install-deps chromium

# Install Playwright browsers as root to system location
RUN npx playwright install chromium

# Create browser directory and set permissions
RUN mkdir -p /ms-playwright && \
    chmod 755 /ms-playwright

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nextjs

# Copy application files
COPY . .

# Change ownership to nextjs user, but keep browser accessible
RUN chown -R nextjs:nodejs /app && \
    chmod -R 755 /ms-playwright

# Switch to non-root user
USER nextjs

# Verify browser installation
RUN ls -la $PLAYWRIGHT_BROWSERS_PATH || echo "Browser path not found, using default location"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "server.js"] 