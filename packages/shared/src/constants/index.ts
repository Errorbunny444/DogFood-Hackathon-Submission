export const APP_MODES = ['demo', 'selfhosted', 'cloud'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const SOURCE_TYPES = ['REAL', 'FIXTURE', 'IMPORTED'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const GLOBAL_ROLES = ['USER', 'ADMIN'] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const ORG_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
export type OrgMembershipStatus = (typeof ORG_MEMBERSHIP_STATUSES)[number];

export const EVENT_ROLES = ['PARTICIPANT', 'JUDGE', 'ORGANIZER'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

export const MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'REMOVED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const TEAM_ROLES = ['OWNER', 'MEMBER'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const EVENT_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION',
  'ACTIVE',
  'SUBMISSIONS_CLOSED',
  'JUDGING',
  'RESULTS_READY',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const VALID_EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PUBLISHED', 'REGISTRATION', 'ARCHIVED'],
  PUBLISHED: ['REGISTRATION', 'ACTIVE', 'ARCHIVED'],
  REGISTRATION: ['ACTIVE', 'SUBMISSIONS_CLOSED', 'ARCHIVED'],
  ACTIVE: ['SUBMISSIONS_CLOSED', 'ARCHIVED'],
  SUBMISSIONS_CLOSED: ['JUDGING', 'ACTIVE', 'ARCHIVED'],
  JUDGING: ['RESULTS_READY', 'SUBMISSIONS_CLOSED', 'ARCHIVED'],
  RESULTS_READY: ['COMPLETED', 'JUDGING', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export const PROJECT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'DISQUALIFIED',
  'WITHDRAWN',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DUPLICATE_STATUSES = ['NONE', 'SUSPECTED', 'CONFIRMED'] as const;
export type DuplicateStatus = (typeof DUPLICATE_STATUSES)[number];

export const REVIEW_STATUSES = ['DRAFT', 'SUBMITTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const COVERAGE_STATUSES = [
  'UNREVIEWED',
  'UNDER_REVIEWED',
  'COMPLETE',
  'OVER_REVIEWED',
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const JUDGE_FLAGS = [
  'CONSTANT_SCORER',
  'LOW_VARIANCE',
  'HIGH_BIAS',
  'LOW_COMPLETION',
  'POSSIBLE_OUTLIER',
] as const;
export type JudgeFlag = (typeof JUDGE_FLAGS)[number];

export const QUESTION_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'BOOLEAN',
  'SELECT',
  'MULTISELECT',
  'URL',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DEFAULT_TARGET_REVIEWS_PER_PROJECT = 3;
export const DEFAULT_SHRINKAGE_K = 5;
export const DEFAULT_RUBRIC_MIN_SCORE = 1;
export const DEFAULT_RUBRIC_MAX_SCORE = 5;

export const AUDIT_ACTIONS = [
  'AUTH.LOGIN',
  'AUTH.LOGOUT',
  'EVENT.CREATED',
  'EVENT.UPDATED',
  'EVENT.DEADLINE_UPDATED',
  'TEAM.CREATED',
  'TEAM.MEMBER_ADDED',
  'TEAM.MEMBER_REMOVED',
  'PROJECT.CREATED',
  'PROJECT.UPDATED',
  'PROJECT.SUBMITTED',
  'PROJECT.DISQUALIFIED',
  'PROJECT.DUPLICATE_RESOLVED',
  'JUDGE.ASSIGNED',
  'JUDGE.UNASSIGNED',
  'REVIEW.CREATED',
  'REVIEW.UPDATED',
  'REVIEW.SUBMITTED',
  'RUBRIC.UPDATED',
  'NORMALIZATION.RUN',
  'RESULTS.PUBLISHED',
  'VOTE.CAST',
  'COMMENT.CREATED',
  'WEBHOOK.CREATED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const DETERMINISTIC_SESSIONS = {
  ORGANIZER: 'dogfood_org_session_token_2026',
  JUDGE_A: 'dogfood_judge_a_session_token_2026',
  JUDGE_B: 'dogfood_judge_b_session_token_2026',
  PARTICIPANT: 'dogfood_participant_session_token_2026',
} as const;
