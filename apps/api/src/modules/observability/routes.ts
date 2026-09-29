import { FastifyPluginAsync } from 'fastify';
import { metricsCollector } from '../../services/observability/metrics.js';

export const observabilityRoutes: FastifyPluginAsync = async (app) => {
  // 1. Prometheus / JSON Metrics Endpoint (Section 35)
  app.get('/metrics', async (request, reply) => {
    const query = request.query as { format?: string };
    const accept = request.headers['accept'] || '';

    if (query.format === 'prometheus' || accept.includes('text/plain')) {
      const text = await metricsCollector.getPrometheusMetrics();
      reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return text;
    }

    const metrics = await metricsCollector.getMetrics();
    return metrics;
  });

  // 2. Detailed Health Check (Section 74)
  app.get('/health', async () => {
    const metrics = await metricsCollector.getMetrics();
    return {
      status: metrics.status,
      timestamp: metrics.timestamp,
      uptimeSeconds: metrics.uptimeSeconds,
      database: {
        connected: metrics.database.connected,
        latencyMs: metrics.database.latencyMs,
      },
      jobs: metrics.jobs,
      version: '1.0.0',
    };
  });

  // 3. Readiness Probe
  app.get('/ready', async (request, reply) => {
    const metrics = await metricsCollector.getMetrics();
    if (!metrics.database.connected) {
      return reply.status(503).send({
        ready: false,
        status: 'unhealthy',
        error: 'Database connection offline',
      });
    }

    return {
      ready: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  });
};
