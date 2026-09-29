# Stage 1: Build Frontend SPA
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace configurations
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./

# Copy packages and web app
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build web
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @dogfood/shared build
RUN pnpm --filter @dogfood/web build

# Stage 2: Caddy Web Server
FROM caddy:2.9-alpine

COPY --from=builder /app/apps/web/dist /srv/dist
COPY infrastructure/caddy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
