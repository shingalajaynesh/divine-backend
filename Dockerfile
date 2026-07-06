# Production Multi-Stage Dockerfile for Divine Backend
# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all source files first so local file dependencies resolve correctly during npm install
COPY divine-data-models ./divine-data-models
COPY divine-backend ./divine-backend

# Install dependencies for both directories
WORKDIR /app/divine-data-models
RUN npm install --omit=dev

WORKDIR /app/divine-backend
RUN npm install --omit=dev

# Stage 2: Runtime Environment
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Setup non-root execution user for security compliance
RUN addgroup -g 1001 -S nodejs && adduser -S nestuser -u 1001

# Copy built code from builder stage
COPY --from=builder /app/divine-data-models ./divine-data-models
COPY --from=builder /app/divine-backend ./divine-backend

WORKDIR /app/divine-backend

EXPOSE 4000

USER nestuser

CMD ["sh", "-c", "npx sequelize-cli db:migrate && node src/scripts/sync-db.js && node src/scripts/seed-data.js && node src/index.js"]
