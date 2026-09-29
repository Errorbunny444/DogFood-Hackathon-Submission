import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

import { authenticate } from './middleware/auth.js';
import {
  securityHeadersHook,
  csrfProtectionHook,
  registerMetricsHook,
} from './middleware/security.js';
import { metricsCollector } from './services/observability/metrics.js';
import { getErrorReporter } from './services/observability/error-reporter.js';

import { publicRoutes } from './modules/public/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { mfaRoutes } from './modules/auth/mfa-routes.js';
import { oauthRoutes } from './modules/auth/oauth-routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { observabilityRoutes } from './modules/observability/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { judgeRoutes } from './modules/judges/routes.js';
import { judgingRoutes } from './modules/judging/routes.js';
import { exportRoutes } from './modules/exports/routes.js';
import { integrityRoutes } from './modules/integrity/routes.js';
import { normalizationRoutes } from './modules/normalization/routes.js';
import { resultRoutes } from './modules/results/routes.js';
import { projectRoutes } from './modules/projects/routes.js';
import { teamRoutes } from './modules/teams/routes.js';
import { votingRoutes } from './modules/voting/routes.js';
import { commentRoutes } from './modules/comments/routes.js';
import { auditRoutes } from './modules/audit/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { certificateRoutes } from './modules/certificates/routes.js';
import { organizationRoutes } from './modules/organizations/routes.js';
import { jobRoutes } from './modules/jobs/routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false, // Clean stdout for acceptance logs and test readability
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // Plugins
  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.register(cookie, {
    secret: 'dogfood_cookie_secret_super_safe_2026',
  });

  app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // OpenAPI Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'DOGFOOD 2026 API',
        description: 'Auditable Self-Hosted Hackathon Submission & Judging Platform API',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1' }],
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Telemetry & Metrics Hook
  registerMetricsHook(app);

  // Attach requestId and Security Headers
  app.addHook('onRequest', async (request, reply) => {
    request.requestId = (request.id as string) || crypto.randomUUID();
    reply.header('x-request-id', request.requestId);
    await securityHeadersHook(request, reply);
  });

  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', csrfProtectionHook);

  // Register All Domain Routes
  app.register(
    async (v1) => {
      // Observability, Metrics & Health Routes (/api/v1/metrics, /api/v1/health, /api/v1/ready)
      v1.register(observabilityRoutes);

      // Public Routes (/api/v1/public/*)
      v1.register(publicRoutes, { prefix: '/public' });

      // Auth Routes (/api/v1/auth/*)
      v1.register(authRoutes, { prefix: '/auth' });
      v1.register(mfaRoutes, { prefix: '/auth/mfa' });
      v1.register(oauthRoutes, { prefix: '/auth/oauth' });

      // In-app Notifications Routes (/api/v1/notifications/*)
      v1.register(notificationRoutes, { prefix: '/notifications' });

      // Organization Routes (/api/v1/organizations/*)
      v1.register(organizationRoutes, { prefix: '/organizations' });

      // Events Routes (/api/v1/events/*)
      v1.register(eventRoutes, { prefix: '/events' });
      v1.register(exportRoutes, { prefix: '/events' });
      v1.register(integrityRoutes, { prefix: '/events' });
      v1.register(normalizationRoutes, { prefix: '/events' });
      v1.register(resultRoutes, { prefix: '/events' });
      v1.register(judgingRoutes, { prefix: '/events' });
      v1.register(votingRoutes, { prefix: '/events' });
      v1.register(auditRoutes, { prefix: '/events' });
      v1.register(webhookRoutes, { prefix: '/events' });
      v1.register(certificateRoutes, { prefix: '/events' });

      // Judge & Judging Routes
      v1.register(judgeRoutes, { prefix: '/judges' });
      v1.register(judgingRoutes, { prefix: '/judge' });

      // Project & Comment Routes
      v1.register(projectRoutes, { prefix: '/projects' });
      v1.register(commentRoutes, { prefix: '/projects' });

      // Team Routes
      v1.register(teamRoutes, { prefix: '/teams' });
      v1.register(teamRoutes, { prefix: '/team-invites' });

      // Background Jobs & Worker Routes
      v1.register(jobRoutes, { prefix: '/jobs' });
    },
    { prefix: '/api/v1' }
  );

  // Serve uploaded files statically
  const uploadsDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Serve compiled web frontend if available
  const possiblePaths = [
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(__dirname, '../../web/dist'),
  ];
  const webDistPath = possiblePaths.find((p) => fs.existsSync(p));

  if (webDistPath) {
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA fallback for HTML5 routing
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/uploads')) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Resource '${request.method} ${request.url}' not found.`,
            requestId: request.requestId,
          },
        });
      }
      return reply.sendFile('index.html');
    });
  }

  // Centralized Error Handling Envelope (Sections 35, 36)
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const errorCode = error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');

    // Record error telemetry
    metricsCollector.recordError(errorCode, error.message || 'Unknown error', request.url);

    // Report unexpected server errors to ErrorReporter abstraction
    if (statusCode >= 500) {
      getErrorReporter().captureException(error, {
        requestId: request.requestId,
        route: request.url,
        method: request.method,
        statusCode,
        userId: request.user?.userId,
      });
    }

    reply.status(statusCode).send({
      error: {
        code: errorCode,
        message: error.message || 'An unexpected error occurred.',
        requestId: request.requestId,
      },
    });
  });

  return app;
}
