export * from '../constants/index.js';
export * from '../schemas/index.js';

export interface UserSessionPayload {
  userId: string;
  email: string;
  displayName: string;
  globalRole: string;
  sessionId: string;
}

export interface JudgeCalibrationStat {
  judgeId: string;
  sourceId: string | null;
  name: string;
  email: string;
  reviewCount: number;
  completionRate: number;
  mean: number;
  median: number;
  variance: number;
  standardDeviation: number;
  min: number;
  max: number;
  observedBias: number;
  adjustedBias: number;
  shrinkageFactor: number;
  flags: string[];
}

export interface ProjectIntegrityCoverage {
  projectId: string;
  sourceId: string | null;
  title: string;
  trackName: string;
  teamName: string;
  reviewCount: number;
  targetReviews: number;
  coverageRatio: number;
  coverageStatus: string;
  rawScore: number | null;
  normalizedScore: number | null;
  scoreRange: number | null;
  scoreVariance: number | null;
  isHighDisagreement: boolean;
  duplicateStatus: string;
}

export interface NormalizationProofItem {
  projectId: string;
  projectSourceId: string | null;
  title: string;
  trackName: string;
  reviewCount: number;
  rawAverage: number;
  normalizedAverage: number;
  rawRank: number;
  normalizedRank: number;
  rankShift: number;
  reviews: {
    reviewId: string;
    judgeName: string;
    judgeSourceId: string | null;
    rawScore: number;
    judgeMean: number;
    globalMean: number;
    observedBias: number;
    shrinkageFactor: number;
    adjustedBias: number;
    normalizedScore: number;
  }[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'TEAM_INVITE' | 'JUDGE_ASSIGNED' | 'SUBMISSION_CONFIRMATION' | 'RESULTS_PUBLISHED' | 'DEADLINE_WARNING' | 'SYSTEM';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface UserMfaStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  eventId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  actorName?: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SystemMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  requests: {
    total: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
    averageLatencyMs: number;
    p95LatencyMs: number;
    activeRequests: number;
  };
  errors: {
    total: number;
    recent: { timestamp: string; code: string; message: string; route?: string }[];
  };
  database: {
    connected: boolean;
    latencyMs: number;
    activePoolConnections?: number;
  };
  jobs: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  email: {
    sent: number;
    failed: number;
  };
  webhooks: {
    sent: number;
    failed: number;
  };
}
