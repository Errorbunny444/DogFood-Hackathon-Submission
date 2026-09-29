import { z } from 'zod';
import {
  APP_MODES,
  SOURCE_TYPES,
  GLOBAL_ROLES,
  EVENT_ROLES,
  MEMBERSHIP_STATUSES,
  TEAM_ROLES,
  EVENT_STATUSES,
  PROJECT_STATUSES,
  DUPLICATE_STATUSES,
  REVIEW_STATUSES,
  COVERAGE_STATUSES,
  JUDGE_FLAGS,
  QUESTION_TYPES,
  AUDIT_ACTIONS,
  ORG_ROLES,
  ORG_MEMBERSHIP_STATUSES,
} from '../constants/index.js';

export const systemConfigSchema = z.object({
  appMode: z.enum(APP_MODES),
  demoEnabled: z.boolean(),
  version: z.string(),
});
export type SystemConfig = z.infer<typeof systemConfigSchema>;

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(16),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarPath: z.string().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Organization Schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(500).default(''),
  website: z.string().url().or(z.literal('')).optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().or(z.literal('')).optional(),
  logoObjectId: z.string().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const addOrganizationMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).default('MEMBER'),
});
export type AddOrganizationMemberInput = z.infer<typeof addOrganizationMemberSchema>;

export const updateOrganizationMemberSchema = z.object({
  role: z.enum(ORG_ROLES),
});
export type UpdateOrganizationMemberInput = z.infer<typeof updateOrganizationMemberSchema>;

// Event Schemas
export const createEventSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().default(''),
  timezone: z.string().default('UTC'),
  registrationOpensAt: z.string().datetime().nullable().optional(),
  registrationClosesAt: z.string().datetime().nullable().optional(),
  eventStartsAt: z.string().datetime().nullable().optional(),
  eventEndsAt: z.string().datetime().nullable().optional(),
  submissionDeadline: z.string().datetime(),
  judgingStartsAt: z.string().datetime().nullable().optional(),
  judgingEndsAt: z.string().datetime().nullable().optional(),
  resultsPublishAt: z.string().datetime().nullable().optional(),
  communityVotingEnabled: z.boolean().default(false),
  commentsEnabled: z.boolean().default(true),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial();
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventStatusTransitionSchema = z.object({
  status: z.enum(EVENT_STATUSES),
  reason: z.string().optional(),
});
export type EventStatusTransitionInput = z.infer<typeof eventStatusTransitionSchema>;

export const eventTimelineUpdateSchema = z.object({
  registrationOpensAt: z.string().datetime().nullable().optional(),
  registrationClosesAt: z.string().datetime().nullable().optional(),
  eventStartsAt: z.string().datetime().nullable().optional(),
  eventEndsAt: z.string().datetime().nullable().optional(),
  submissionDeadline: z.string().datetime().optional(),
  judgingStartsAt: z.string().datetime().nullable().optional(),
  judgingEndsAt: z.string().datetime().nullable().optional(),
  resultsPublishAt: z.string().datetime().nullable().optional(),
});
export type EventTimelineUpdateInput = z.infer<typeof eventTimelineUpdateSchema>;

export const eventWizardSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().default(''),
  timezone: z.string().default('UTC'),
  organizationId: z.string().uuid().optional(),
  registrationOpensAt: z.string().datetime().nullable().optional(),
  registrationClosesAt: z.string().datetime().nullable().optional(),
  eventStartsAt: z.string().datetime().nullable().optional(),
  eventEndsAt: z.string().datetime().nullable().optional(),
  submissionDeadline: z.string().datetime(),
  judgingStartsAt: z.string().datetime().nullable().optional(),
  judgingEndsAt: z.string().datetime().nullable().optional(),
  resultsPublishAt: z.string().datetime().nullable().optional(),
  communityVotingEnabled: z.boolean().default(false),
  commentsEnabled: z.boolean().default(true),
  initialStatus: z.enum(EVENT_STATUSES).default('DRAFT'),

  tracks: z.array(z.object({
    name: z.string().min(2),
    description: z.string().default(''),
  })).default([]),

  prizes: z.array(z.object({
    name: z.string().min(2),
    description: z.string().default(''),
    amount: z.string().optional(),
    trackIndex: z.number().optional(),
  })).default([]),

  rubric: z.object({
    name: z.string().default('General Evaluation Rubric'),
    description: z.string().default('Standard weighted rubric for project assessment'),
    criteria: z.array(z.object({
      name: z.string().min(2),
      key: z.string().optional(),
      description: z.string().default(''),
      weight: z.number().min(0).max(1),
      minScore: z.number().min(0).default(1),
      maxScore: z.number().min(1).default(5),
    })).min(1, 'Rubric must contain at least one criterion'),
  }),

  submissionQuestions: z.array(z.object({
    question: z.string().min(2),
    type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'URL']),
    options: z.array(z.string()).optional(),
    required: z.boolean().default(false),
  })).default([]),
});
export type EventWizardInput = z.infer<typeof eventWizardSchema>;

// Track & Prize Schemas
export const createTrackSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().default(''),
});
export type CreateTrackInput = z.infer<typeof createTrackSchema>;

export const createPrizeSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().default(''),
  amount: z.string().optional(),
  trackId: z.string().uuid().nullable().optional(),
});
export type CreatePrizeInput = z.infer<typeof createPrizeSchema>;

// Team Schemas
export const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
});
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

// Project & Submission Schemas
export const createProjectSchema = z.object({
  title: z.string().min(2).max(200),
  summary: z.string().max(500).default(''),
  description: z.string().default(''),
  tagline: z.string().max(150).optional().default(''),
  repositoryUrl: z.string().url().or(z.literal('')).optional(),
  demoUrl: z.string().url().or(z.literal('')).optional(),
  videoUrl: z.string().url().or(z.literal('')).optional(),
  trackId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  sourceType: z.enum(SOURCE_TYPES).default('REAL').optional(),
  answers: z.record(z.unknown()).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const resolveDuplicateSchema = z.object({
  duplicateStatus: z.enum(DUPLICATE_STATUSES),
  duplicateOf: z.string().uuid().nullable().optional(),
  reason: z.string().optional(),
});
export type ResolveDuplicateInput = z.infer<typeof resolveDuplicateSchema>;

// Judge Invitation & Preference Schemas
export const inviteJudgeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).optional(),
  maxWorkload: z.number().int().min(1).default(15),
});
export type InviteJudgeInput = z.infer<typeof inviteJudgeSchema>;

export const declareConflictSchema = z.object({
  projectId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  reason: z.string().default('Conflict of interest'),
});
export type DeclareConflictInput = z.infer<typeof declareConflictSchema>;

export const setTrackPreferencesSchema = z.object({
  trackIds: z.array(z.string().uuid()),
});
export type SetTrackPreferencesInput = z.infer<typeof setTrackPreferencesSchema>;

export const saveAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.any(),
    })
  ),
});
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;

// Rubric & Criteria Schemas
export const rubricCriterionSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().default(''),
  minScore: z.number().int().default(1),
  maxScore: z.number().int().default(5),
  weight: z.number().min(0).max(1),
  position: z.number().int().default(0),
});
export type RubricCriterionInput = z.infer<typeof rubricCriterionSchema>;

export const createRubricSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().default(''),
  criteria: z.array(rubricCriterionSchema).min(1),
});
export type CreateRubricInput = z.infer<typeof createRubricSchema>;

// Review & Score Schemas
export const scoreInputSchema = z.object({
  criterionId: z.string().uuid(),
  score: z.number().min(1).max(5),
  comment: z.string().optional(),
});
export type ScoreInput = z.infer<typeof scoreInputSchema>;

export const updateReviewSchema = z.object({
  scores: z.array(scoreInputSchema),
  overallComment: z.string().optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

// Judge Assignment & Preferences Schemas
export const updateJudgeProfileSchema = z.object({
  bio: z.string().optional(),
  trackPreferences: z.array(z.string().uuid()).optional(),
  conflicts: z.array(z.string().uuid()).optional(), // team or project ids
  maxWorkload: z.number().int().min(1).max(50).default(15),
});
export type UpdateJudgeProfileInput = z.infer<typeof updateJudgeProfileSchema>;

export const autoAssignSchema = z.object({
  targetReviewsPerProject: z.number().int().min(1).max(10).default(3),
  maxWorkloadPerJudge: z.number().int().min(1).max(50).default(15),
  respectTrackPreferences: z.boolean().default(true),
  preventConflicts: z.boolean().default(true),
});
export type AutoAssignInput = z.infer<typeof autoAssignSchema>;

// Normalization Schemas
export const runNormalizationSchema = z.object({
  shrinkageK: z.number().min(0).max(20).default(5),
});
export type RunNormalizationInput = z.infer<typeof runNormalizationSchema>;

// Community Voting Schemas
export const castVoteSchema = z.object({
  projectId: z.string().uuid(),
});
export type CastVoteInput = z.infer<typeof castVoteSchema>;

// Comment Schemas
export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// Webhook Schemas
export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16),
  active: z.boolean().default(true),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// Error Envelope Schema
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
