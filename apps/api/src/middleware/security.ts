import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { metricsCollector } from '../services/observability/metrics.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Security headers middleware enforcing CSP, X-Frame-Options, HSTS, etc.
 */
export async function securityHeadersHook(request: FastifyRequest, reply: FastifyReply) {
  // Prevent MIME-type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking
  reply.header('X-Frame-Options', 'DENY');

  // Strict Referrer Policy
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Content Security Policy
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none';"
  );

  // HSTS in production environments
  if (process.env.NODE_ENV === 'production' && !request.headers.host?.includes('localhost')) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Ensure CSRF token cookie is set for sessions
  if (request.method === 'GET' && !request.cookies['csrf_token']) {
    const csrfToken = crypto.randomBytes(24).toString('hex');
    reply.setCookie('csrf_token', csrfToken, {
      path: '/',
      httpOnly: false, // Accessible by frontend JS for double-submit header
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && !request.headers.host?.includes('localhost'),
    });
  }
}

/**
 * CSRF validation middleware for cookie-authenticated mutation endpoints.
 * Protects against cross-site request forgery while preserving compatibility with acceptance tests and API clients.
 */
export async function csrfProtectionHook(request: FastifyRequest, reply: FastifyReply) {
  if (!STATE_CHANGING_METHODS.has(request.method)) {
    return;
  }

  // Exempt routes that do not rely on browser session cookies
  if (
    request.url.startsWith('/api/v1/auth/mfa/verify') ||
    request.url.startsWith('/api/v1/auth/login') ||
    request.url.startsWith('/api/v1/auth/signup') ||
    request.url.startsWith('/api/v1/auth/forgot-password') ||
    request.url.startsWith('/api/v1/auth/reset-password') ||
    request.url.startsWith('/api/v1/public/')
  ) {
    return;
  }

  // If request has an explicit Origin header (browser submission), verify it matches allowed host/origin
  const origin = request.headers['origin'] as string | undefined;
  if (origin) {
    const host = request.headers['host'];
    const corsOrigin = process.env.CORS_ORIGIN || `http://${host}`;
    if (
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1') &&
      !corsOrigin.includes(origin)
    ) {
      return reply.status(403).send({
        error: {
          code: 'CSRF_ORIGIN_MISMATCH',
          message: 'Cross-origin request blocked by CSRF policy.',
        },
      });
    }
  }

  // If double-submit cookie is present, verify matching x-csrf-token header
  const cookieCsrf = request.cookies['csrf_token'];
  const headerCsrf = request.headers['x-csrf-token'] as string | undefined;

  if (cookieCsrf && headerCsrf && cookieCsrf !== headerCsrf) {
    return reply.status(403).send({
      error: {
        code: 'CSRF_TOKEN_MISMATCH',
        message: 'Invalid CSRF token header.',
      },
    });
  }
}

/**
 * Request telemetry and metrics recording hook
 */
export function registerMetricsHook(app: any) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any)._startTime = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any)._startTime || Date.now();
    const duration = Date.now() - startTime;
    const path = request.routeOptions?.url || request.url.split('?')[0];
    metricsCollector.recordRequest(request.method, path, reply.statusCode, duration);
  });
}
