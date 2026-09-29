import { getDb, jobs } from '@dogfood/database';
import { sql, eq } from 'drizzle-orm';
import { SystemMetrics } from '@dogfood/shared';

interface ErrorEntry {
  timestamp: string;
  code: string;
  message: string;
  route?: string;
}

class MetricsCollector {
  private startTime = Date.now();
  private totalRequests = 0;
  private byMethod: Record<string, number> = {};
  private byStatus: Record<string, number> = {};
  private latencies: number[] = [];
  private activeRequests = 0;

  private totalErrors = 0;
  private recentErrors: ErrorEntry[] = [];

  private emailSent = 0;
  private emailFailed = 0;

  private webhookSent = 0;
  private webhookFailed = 0;

  startRequest(): () => void {
    this.activeRequests++;
    return () => {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
    };
  }

  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.totalRequests++;
    this.byMethod[method] = (this.byMethod[method] || 0) + 1;
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.byStatus[statusGroup] = (this.byStatus[statusGroup] || 0) + 1;
    this.byStatus[statusCode.toString()] = (this.byStatus[statusCode.toString()] || 0) + 1;

    // Keep sliding window of last 1000 latencies
    this.latencies.push(durationMs);
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
  }

  recordError(code: string, message: string, route?: string): void {
    this.totalErrors++;
    this.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      code,
      message,
      route,
    });
    if (this.recentErrors.length > 50) {
      this.recentErrors.pop();
    }
  }

  recordEmail(success: boolean): void {
    if (success) {
      this.emailSent++;
    } else {
      this.emailFailed++;
    }
  }

  recordWebhook(success: boolean): void {
    if (success) {
      this.webhookSent++;
    } else {
      this.webhookFailed++;
    }
  }

  async getMetrics(): Promise<SystemMetrics> {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    // Calculate latency percentiles
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const avgLatency =
      sorted.length > 0 ? sorted.reduce((sum, v) => sum + v, 0) / sorted.length : 0;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Latency = sorted.length > 0 ? sorted[p95Index] || sorted[sorted.length - 1] : 0;

    // Check DB health & latency
    let dbConnected = false;
    let dbLatencyMs = 0;
    let jobStats = { pending: 0, running: 0, completed: 0, failed: 0 };

    try {
      const db = getDb();
      const t0 = Date.now();
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Date.now() - t0;
      dbConnected = true;

      // Query jobs status
      const jobCounts = await db
        .select({
          status: jobs.status,
          count: sql<number>`count(*)::int`,
        })
        .from(jobs)
        .groupBy(jobs.status);

      for (const row of jobCounts) {
        if (row.status === 'PENDING') jobStats.pending = Number(row.count);
        if (row.status === 'RUNNING') jobStats.running = Number(row.count);
        if (row.status === 'COMPLETED') jobStats.completed = Number(row.count);
        if (row.status === 'FAILED') jobStats.failed = Number(row.count);
      }
    } catch {
      dbConnected = false;
    }

    const status: 'healthy' | 'degraded' | 'unhealthy' = !dbConnected
      ? 'unhealthy'
      : jobStats.failed > 20 || avgLatency > 2000
      ? 'degraded'
      : 'healthy';

    return {
      status,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      requests: {
        total: this.totalRequests,
        byMethod: { ...this.byMethod },
        byStatus: { ...this.byStatus },
        averageLatencyMs: Math.round(avgLatency * 100) / 100,
        p95LatencyMs: Math.round(p95Latency * 100) / 100,
        activeRequests: this.activeRequests,
      },
      errors: {
        total: this.totalErrors,
        recent: [...this.recentErrors],
      },
      database: {
        connected: dbConnected,
        latencyMs: dbLatencyMs,
      },
      jobs: jobStats,
      email: {
        sent: this.emailSent,
        failed: this.emailFailed,
      },
      webhooks: {
        sent: this.webhookSent,
        failed: this.webhookFailed,
      },
    };
  }

  async getPrometheusMetrics(): Promise<string> {
    const m = await this.getMetrics();
    const lines = [
      '# HELP dogfood_uptime_seconds Total application uptime in seconds',
      '# TYPE dogfood_uptime_seconds gauge',
      `dogfood_uptime_seconds ${m.uptimeSeconds}`,
      '',
      '# HELP dogfood_requests_total Total number of HTTP requests received',
      '# TYPE dogfood_requests_total counter',
      `dogfood_requests_total ${m.requests.total}`,
      '',
      '# HELP dogfood_request_duration_average_ms Average request latency in milliseconds',
      '# TYPE dogfood_request_duration_average_ms gauge',
      `dogfood_request_duration_average_ms ${m.requests.averageLatencyMs}`,
      '',
      '# HELP dogfood_request_duration_p95_ms 95th percentile request latency in milliseconds',
      '# TYPE dogfood_request_duration_p95_ms gauge',
      `dogfood_request_duration_p95_ms ${m.requests.p95LatencyMs}`,
      '',
      '# HELP dogfood_errors_total Total application errors handled',
      '# TYPE dogfood_errors_total counter',
      `dogfood_errors_total ${m.errors.total}`,
      '',
      '# HELP dogfood_db_connected Database connection state (1 for connected, 0 for down)',
      '# TYPE dogfood_db_connected gauge',
      `dogfood_db_connected ${m.database.connected ? 1 : 0}`,
      '',
      '# HELP dogfood_db_latency_ms Database roundtrip ping latency in milliseconds',
      '# TYPE dogfood_db_latency_ms gauge',
      `dogfood_db_latency_ms ${m.database.latencyMs}`,
      '',
      '# HELP dogfood_jobs_pending Background jobs waiting in queue',
      '# TYPE dogfood_jobs_pending gauge',
      `dogfood_jobs_pending ${m.jobs.pending}`,
      '',
      '# HELP dogfood_jobs_failed Background jobs in failed status',
      '# TYPE dogfood_jobs_failed gauge',
      `dogfood_jobs_failed ${m.jobs.failed}`,
      '',
      '# HELP dogfood_emails_sent Total transactional emails sent',
      '# TYPE dogfood_emails_sent counter',
      `dogfood_emails_sent ${m.email.sent}`,
      '',
      '# HELP dogfood_emails_failed Total transactional email failures',
      '# TYPE dogfood_emails_failed counter',
      `dogfood_emails_failed ${m.email.failed}`,
    ];

    for (const [method, count] of Object.entries(m.requests.byMethod)) {
      lines.push(`dogfood_requests_by_method{method="${method}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }
}

export const metricsCollector = new MetricsCollector();
