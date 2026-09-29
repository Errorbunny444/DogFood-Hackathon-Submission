FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @dogfood/shared build
RUN pnpm --filter @dogfood/web build

FROM alpine:latest
WORKDIR /dist
COPY --from=builder /app/apps/web/dist ./
CMD ["echo", "Frontend assets built successfully"]
