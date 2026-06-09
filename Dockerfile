# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────────
# Stage 1: build
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cache friendly)
COPY package*.json ./
RUN npm ci --force

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
COPY fixtures/ ./fixtures/
COPY docs/ ./docs/

RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 2: runtime
# ──────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="bConnect Mock Server" \
      org.opencontainers.image.description="Mock server for baramundi bConnect V2.0 REST API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="baramundi software GmbH"

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev --force && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/build ./build

# Copy static assets needed at runtime
COPY --from=builder /app/fixtures ./fixtures
COPY --from=builder /app/docs ./docs

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Server listens on PORT (default 3433)
EXPOSE 3433

# Health check — uses Node's built-in http module (no curl dependency)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "\
    require('http').get('http://localhost:' + (process.env.PORT || 3433) + '/health', (r) => { \
      process.exit(r.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

CMD ["node", "build/index.js"]
