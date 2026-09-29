export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Job<T = any> {
  id: string;
  queue: string;
  name: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  lastError?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
}

export interface EnqueueOptions {
  queue?: string;
  runAt?: Date;
  maxAttempts?: number;
}

export type JobHandler<T = any> = (payload: T, job: Job<T>) => Promise<void>;

export interface JobStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}
