FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace setup
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./

# Copy packages & apps
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY apps/api/ ./apps/api/
COPY fixtures.json ./

# Install dependencies and build
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @dogfood/shared build
RUN pnpm --filter @dogfood/database build
RUN pnpm --filter @dogfood/judging-engine build
RUN pnpm --filter @dogfood/fixture-importer build
RUN pnpm --filter @dogfood/web build
RUN pnpm --filter @dogfood/api build

# Runtime Stage
FROM node:22-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy node_modules and built code from builder
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/fixtures.json ./fixtures.json

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV APP_MODE=demo
ENV SEED_DEMO_DATA=true

EXPOSE 8080

CMD ["node", "dist/server.js"]
