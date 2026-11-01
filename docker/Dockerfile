# ==============================================================================
# VeerSeva - Dockerfile (Multi-Stage Production Build)
# Built to CERT-In compliance: Non-root user, minimal surface attack area
# ==============================================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY backend/package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime Production Image
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Security: Install dumb-init to properly handle PID 1 signals
RUN apk add --no-cache dumb-init

# Create non-root user
USER node

# Copy dependencies from builder
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node frontend/ ./frontend/

WORKDIR /usr/src/app/backend

# Create uploads directory with appropriate permissions
USER root
RUN mkdir -p /usr/src/app/backend/uploads && chown -R node:node /usr/src/app/backend/uploads
USER node

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
