import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Automatically load root or local .env if present
try {
  const envCandidates = ['.env', '../.env', '../../.env'];
  for (const c of envCandidates) {
    const full = path.resolve(process.cwd(), c);
    if (fs.existsSync(full)) {
      if (typeof (process as any).loadEnvFile === 'function') {
        (process as any).loadEnvFile(full);
      }
      break;
    }
  }
} catch {
  // Ignore error if loadEnvFile fails
}

const configSchema = z.object({
  port: z.coerce.number().default(8080),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  appMode: z.enum(['demo', 'selfhosted', 'cloud']).default('demo'),
  appUrl: z.string().default('http://localhost:8080'),
  corsOrigin: z.string().default('http://localhost:8080'),
  databaseUrl: z.string().optional(),
  pgliteDir: z.string().default('./data/pgdata'),
  sessionCookieName: z.string().default('session'),
  sessionDurationDays: z.coerce.number().default(30),
  sessionSecret: z.string().default('dogfood_cookie_secret_super_safe_2026'),
  fixturesPath: z.string().default('./fixtures.json'),
  logLevel: z.string().default('info'),
  seedDemoData: z.boolean().default(true),

  // Storage configuration
  storageProvider: z.enum(['local', 's3']).default('local'),
  storageLocalDir: z.string().default('uploads'),
  s3Bucket: z.string().optional(),
  s3Endpoint: z.string().optional(),
  s3Region: z.string().default('auto'),
  s3AccessKeyId: z.string().optional(),
  s3SecretAccessKey: z.string().optional(),

  // Email configuration
  emailProvider: z.enum(['console', 'smtp', 'resend']).default('console'),
  emailFrom: z.string().default('noreply@dogfood.local'),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().default(false),
  resendApiKey: z.string().optional(),

  // Background workers & telemetry
  jobWorkerEnabled: z.boolean().default(true),
  sentryDsn: z.string().optional(),
});

function loadAndValidateConfig() {
  const rawAppMode = (process.env.APP_MODE || 'demo') as 'demo' | 'selfhosted' | 'cloud';
  const rawSeedDemoData =
    process.env.SEED_DEMO_DATA !== undefined
      ? process.env.SEED_DEMO_DATA === 'true'
      : rawAppMode === 'demo';

  const rawConfig = {
    port: process.env.PORT,
    host: process.env.HOST,
    nodeEnv: process.env.NODE_ENV,
    appMode: rawAppMode,
    appUrl: process.env.APP_URL,
    corsOrigin: process.env.CORS_ORIGIN,
    databaseUrl: process.env.DATABASE_URL,
    pgliteDir: process.env.PGLITE_DIR,
    sessionCookieName: process.env.SESSION_COOKIE_NAME,
    sessionDurationDays: process.env.SESSION_DURATION_DAYS,
    sessionSecret: process.env.SESSION_SECRET,
    fixturesPath: process.env.FIXTURES_PATH,
    logLevel: process.env.LOG_LEVEL,
    seedDemoData: rawSeedDemoData,

    storageProvider: process.env.STORAGE_PROVIDER || (rawAppMode === 'cloud' ? 's3' : 'local'),
    storageLocalDir: process.env.STORAGE_LOCAL_DIR,
    s3Bucket: process.env.S3_BUCKET,
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,

    emailProvider: process.env.EMAIL_PROVIDER || (rawAppMode === 'cloud' ? 'resend' : 'console'),
    emailFrom: process.env.EMAIL_FROM,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpSecure: process.env.SMTP_SECURE === 'true',
    resendApiKey: process.env.RESEND_API_KEY,

    jobWorkerEnabled: process.env.JOB_WORKER_ENABLED !== 'false',
    sentryDsn: process.env.SENTRY_DSN,
  };

  const parsed = configSchema.safeParse(rawConfig);

  if (!parsed.success) {
    console.error('❌ Configuration validation failed at startup:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    if (rawAppMode !== 'demo' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error('Invalid configuration');
  }

  const valid = parsed.data;

  // Strict production guards (Section 75: fail fast if required env vars missing)
  if (valid.appMode === 'cloud' && process.env.NODE_ENV !== 'test') {
    const missing: string[] = [];

    if (!valid.databaseUrl) {
      missing.push('DATABASE_URL (production cloud PostgreSQL connection URI required)');
    }

    if (valid.storageProvider === 's3') {
      if (!valid.s3Bucket) missing.push('S3_BUCKET');
      if (!valid.s3AccessKeyId) missing.push('S3_ACCESS_KEY_ID');
      if (!valid.s3SecretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');
    }

    if (valid.emailProvider === 'smtp') {
      if (!valid.smtpHost) missing.push('SMTP_HOST');
      if (!valid.smtpPort) missing.push('SMTP_PORT');
    }

    if (valid.emailProvider === 'resend') {
      if (!valid.resendApiKey) missing.push('RESEND_API_KEY');
    }

    if (missing.length > 0) {
      console.error('\n======================================================');
      console.error(`🚨 FATAL CONFIGURATION ERROR [APP_MODE=${valid.appMode}]`);
      console.error('Production startup halted because required variables are missing:');
      for (const m of missing) {
        console.error(`   • ${m}`);
      }
      console.error('Please configure your .env or container environment variables.');
      console.error('======================================================\n');
      process.exit(1);
    }
  }

  return valid;
}

export const config = loadAndValidateConfig();
export type AppConfig = typeof config;
