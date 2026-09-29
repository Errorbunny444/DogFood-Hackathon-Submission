import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// 1. Users
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: varchar('source_id', { length: 50 }),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    avatarPath: text('avatar_path'),
    globalRole: varchar('global_role', { length: 20 }).notNull().default('USER'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    bio: text('bio').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_source_id').on(table.sourceId),
  ]
);

// 2. Sessions
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    rawToken: text('raw_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_token_hash').on(table.tokenHash),
    index('idx_sessions_raw_token').on(table.rawToken),
  ]
);

// 2b. Auth Identities (Multi-provider authentication)
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // PASSWORD, GITHUB, GOOGLE
    providerUserId: varchar('provider_user_id', { length: 255 }),
    providerEmail: varchar('provider_email', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_auth_identities_user_id').on(table.userId),
    index('idx_auth_identities_provider').on(table.provider, table.providerUserId),
  ]
);

// 2c. Email Verification Tokens
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_email_verification_user').on(table.userId),
    index('idx_email_verification_token').on(table.tokenHash),
  ]
);

// 2d. Password Reset Tokens
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_password_reset_user').on(table.userId),
    index('idx_password_reset_token').on(table.tokenHash),
  ]
);

// 2e. Organizations (Multi-tenant workspaces)
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    logoObjectId: varchar('logo_object_id', { length: 255 }),
    website: varchar('website', { length: 255 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_organizations_slug').on(table.slug),
    index('idx_organizations_created_by').on(table.createdBy),
  ]
);

// 2f. Organization Memberships
export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('MEMBER'), // OWNER, ADMIN, MEMBER
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // INVITED, ACTIVE, SUSPENDED
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_org_memberships_org_user').on(table.organizationId, table.userId),
    index('idx_org_memberships_user_id').on(table.userId),
    index('idx_org_memberships_org_id').on(table.organizationId),
  ]
);

// 3. Events
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    sourceId: varchar('source_id', { length: 50 }),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
    registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }),
    registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }),
    eventStartsAt: timestamp('event_starts_at', { withTimezone: true }),
    eventEndsAt: timestamp('event_ends_at', { withTimezone: true }),
    submissionDeadline: timestamp('submission_deadline', { withTimezone: true }).notNull(),
    judgingStartsAt: timestamp('judging_starts_at', { withTimezone: true }),
    judgingEndsAt: timestamp('judging_ends_at', { withTimezone: true }),
    resultsPublishAt: timestamp('results_publish_at', { withTimezone: true }),
    status: varchar('status', { length: 30 }).notNull().default('ACTIVE'),
    communityVotingEnabled: boolean('community_voting_enabled').notNull().default(false),
    commentsEnabled: boolean('comments_enabled').notNull().default(true),
    resultsPublished: boolean('results_published').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_events_source_id').on(table.sourceId),
    index('idx_events_slug').on(table.slug),
    index('idx_events_organization_id').on(table.organizationId),
  ]
);

// 4. Event Memberships
export const eventMemberships = pgTable(
  'event_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // PARTICIPANT, JUDGE, ORGANIZER
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_event_memberships_event_user').on(table.eventId, table.userId),
    index('idx_event_memberships_role').on(table.role),
  ]
);

// 5. Tracks
export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: varchar('source_id', { length: 50 }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tracks_event_id').on(table.eventId),
    index('idx_tracks_source_id').on(table.sourceId),
  ]
);

// 6. Prizes
export const prizes = pgTable(
  'prizes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    amount: varchar('amount', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_prizes_event_id').on(table.eventId)]
);

// 7. Teams
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: varchar('source_id', { length: 50 }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_teams_event_id').on(table.eventId),
    index('idx_teams_source_id').on(table.sourceId),
  ]
);

// 8. Team Members
export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('MEMBER'), // OWNER, MEMBER
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_team_members_team_user').on(table.teamId, table.userId),
  ]
);

// 9. Team Invites
export const teamInvites = pgTable(
  'team_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    token: varchar('token', { length: 100 }).notNull().unique(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_team_invites_token').on(table.token)]
);

// 10. Projects
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: varchar('source_id', { length: 50 }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    tagline: varchar('tagline', { length: 255 }).default(''),
    summary: text('summary').default(''),
    description: text('description').default(''),
    repositoryUrl: text('repository_url'),
    demoUrl: text('demo_url'),
    videoUrl: text('video_url'),
    thumbnailPath: text('thumbnail_path'),
    status: varchar('status', { length: 30 }).notNull().default('SUBMITTED'), // DRAFT, SUBMITTED, DISQUALIFIED, WITHDRAWN
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    duplicateStatus: varchar('duplicate_status', { length: 20 }).notNull().default('NONE'), // NONE, SUSPECTED, CONFIRMED
    duplicateOf: uuid('duplicate_of'),
    sourceType: varchar('source_type', { length: 32 }).notNull().default('REAL'), // REAL, FIXTURE, IMPORTED
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_projects_event_id').on(table.eventId),
    index('idx_projects_source_id').on(table.sourceId),
    index('idx_projects_team_id').on(table.teamId),
    index('idx_projects_track_id').on(table.trackId),
    index('idx_projects_status').on(table.status),
  ]
);

// 11. Project Tracks
export const projectTracks = pgTable(
  'project_tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_project_tracks_unique').on(table.projectId, table.trackId),
  ]
);

// 12. Project Assets (Uploaded Files, Media, Documents, Archives)
export const projectAssets = pgTable(
  'project_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    uploaderUserId: uuid('uploader_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 50 }).notNull(), // IMAGE, VIDEO, DOCUMENT, ARCHIVE, OTHER
    name: varchar('name', { length: 255 }).notNull(),
    path: text('path').notNull(),
    storageKey: text('storage_key'),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: integer('size_bytes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_project_assets_project_id').on(table.projectId),
    index('idx_project_assets_uploader').on(table.uploaderUserId),
  ]
);

// 13. Submission Questions
export const submissionQuestions = pgTable(
  'submission_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    question: varchar('question', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // TEXT, TEXTAREA, NUMBER, BOOLEAN, SELECT, MULTISELECT, URL
    options: jsonb('options'),
    required: boolean('required').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_submission_questions_event_id').on(table.eventId)]
);

// 14. Submission Answers
export const submissionAnswers = pgTable(
  'submission_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => submissionQuestions.id, { onDelete: 'cascade' }),
    answer: jsonb('answer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_submission_answers_project_question').on(
      table.projectId,
      table.questionId
    ),
  ]
);

// 15. Rubrics
export const rubrics = pgTable(
  'rubrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    version: integer('version').notNull().default(1),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_rubrics_event_id').on(table.eventId)]
);

// 16. Rubric Criteria
export const rubricCriteria = pgTable(
  'rubric_criteria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rubricId: uuid('rubric_id')
      .notNull()
      .references(() => rubrics.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    key: varchar('key', { length: 100 }), // e.g. quality, innovation, functionality
    description: text('description').default(''),
    minScore: integer('min_score').notNull().default(1),
    maxScore: integer('max_score').notNull().default(5),
    weight: doublePrecision('weight').notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_rubric_criteria_rubric_id').on(table.rubricId),
    index('idx_rubric_criteria_key').on(table.key),
  ]
);

// 17. Judge Profiles
export const judgeProfiles = pgTable(
  'judge_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    bio: text('bio').default(''),
    maxWorkload: integer('max_workload').notNull().default(15),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_judge_profiles_event_user').on(table.eventId, table.userId),
  ]
);

// 18. Judge Track Preferences
export const judgeTrackPreferences = pgTable(
  'judge_track_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    judgeUserId: uuid('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_judge_track_prefs_unique').on(
      table.judgeUserId,
      table.eventId,
      table.trackId
    ),
  ]
);

// 19. Judge Conflicts
export const judgeConflicts = pgTable(
  'judge_conflicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    judgeUserId: uuid('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 255 }).default('Conflict of interest'),
  },
  (table) => [
    index('idx_judge_conflicts_judge_event').on(table.judgeUserId, table.eventId),
  ]
);

// 20. Judge Assignments
export const judgeAssignments = pgTable(
  'judge_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    judgeUserId: uuid('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('ASSIGNED'), // ASSIGNED, COMPLETED, DECLINED
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_judge_assignments_unique').on(
      table.judgeUserId,
      table.projectId
    ),
    index('idx_judge_assignments_judge_event').on(table.judgeUserId, table.eventId),
    index('idx_judge_assignments_project').on(table.projectId),
  ]
);

// 21. Reviews
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    judgeUserId: uuid('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rubricId: uuid('rubric_id')
      .notNull()
      .references(() => rubrics.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('SUBMITTED'), // DRAFT, SUBMITTED
    rawScore: doublePrecision('raw_score'),
    overallComment: text('overall_comment').default(''),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_reviews_project_judge').on(table.projectId, table.judgeUserId),
    index('idx_reviews_judge_event').on(table.judgeUserId, table.eventId),
    index('idx_reviews_project').on(table.projectId),
  ]
);

// 22. Review Scores
export const reviewScores = pgTable(
  'review_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    criterionId: uuid('criterion_id')
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: 'cascade' }),
    score: doublePrecision('score').notNull(),
    comment: text('comment').default(''),
  },
  (table) => [
    uniqueIndex('idx_review_scores_unique').on(table.reviewId, table.criterionId),
    index('idx_review_scores_review_id').on(table.reviewId),
  ]
);

// 23. Normalization Runs
export const normalizationRuns = pgTable(
  'normalization_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    algorithm: varchar('algorithm', { length: 100 })
      .notNull()
      .default('MEAN_CENTERING_SHRINKAGE'),
    algorithmVersion: varchar('algorithm_version', { length: 20 })
      .notNull()
      .default('1.0'),
    parameters: jsonb('parameters').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_norm_runs_event_id').on(table.eventId)]
);

// 24. Normalized Reviews
export const normalizedReviews = pgTable(
  'normalized_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    normalizationRunId: uuid('normalization_run_id')
      .notNull()
      .references(() => normalizationRuns.id, { onDelete: 'cascade' }),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    rawScore: doublePrecision('raw_score').notNull(),
    judgeMean: doublePrecision('judge_mean').notNull(),
    globalMean: doublePrecision('global_mean').notNull(),
    observedBias: doublePrecision('observed_bias').notNull(),
    shrinkageFactor: doublePrecision('shrinkage_factor').notNull(),
    adjustedBias: doublePrecision('adjusted_bias').notNull(),
    normalizedScore: doublePrecision('normalized_score').notNull(),
  },
  (table) => [
    index('idx_norm_reviews_run_id').on(table.normalizationRunId),
    index('idx_norm_reviews_review_id').on(table.reviewId),
  ]
);

// 25. Project Results
export const projectResults = pgTable(
  'project_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    normalizationRunId: uuid('normalization_run_id')
      .notNull()
      .references(() => normalizationRuns.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    rawAverage: doublePrecision('raw_average').notNull(),
    normalizedAverage: doublePrecision('normalized_average').notNull(),
    reviewCount: integer('review_count').notNull(),
    rawRank: integer('raw_rank').notNull(),
    normalizedRank: integer('normalized_rank').notNull(),
    rankShift: integer('rank_shift').notNull().default(0),
    isTied: boolean('is_tied').notNull().default(false),
  },
  (table) => [
    uniqueIndex('idx_project_results_run_project').on(
      table.normalizationRunId,
      table.projectId
    ),
    index('idx_project_results_norm_rank').on(table.normalizedRank),
  ]
);

// 26. Judge Statistics
export const judgeStatistics = pgTable(
  'judge_statistics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    normalizationRunId: uuid('normalization_run_id')
      .notNull()
      .references(() => normalizationRuns.id, { onDelete: 'cascade' }),
    judgeUserId: uuid('judge_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reviewCount: integer('review_count').notNull(),
    completionRate: doublePrecision('completion_rate').notNull(),
    mean: doublePrecision('mean').notNull(),
    median: doublePrecision('median').notNull(),
    variance: doublePrecision('variance').notNull(),
    standardDeviation: doublePrecision('standard_deviation').notNull(),
    minimum: doublePrecision('minimum').notNull(),
    maximum: doublePrecision('maximum').notNull(),
    observedBias: doublePrecision('observed_bias').notNull(),
    adjustedBias: doublePrecision('adjusted_bias').notNull(),
    shrinkageFactor: doublePrecision('shrinkage_factor').notNull(),
    flags: jsonb('flags').notNull(),
  },
  (table) => [
    uniqueIndex('idx_judge_stats_run_judge').on(
      table.normalizationRunId,
      table.judgeUserId
    ),
  ]
);

// 27. Project Coverage
export const projectCoverage = pgTable(
  'project_coverage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    normalizationRunId: uuid('normalization_run_id')
      .notNull()
      .references(() => normalizationRuns.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actualReviews: integer('actual_reviews').notNull(),
    targetReviews: integer('target_reviews').notNull(),
    coverageRatio: doublePrecision('coverage_ratio').notNull(),
    coverageStatus: varchar('coverage_status', { length: 30 }).notNull(),
    isHighDisagreement: boolean('is_high_disagreement').notNull().default(false),
    scoreRange: doublePrecision('score_range'),
  },
  (table) => [
    uniqueIndex('idx_project_coverage_run_project').on(
      table.normalizationRunId,
      table.projectId
    ),
  ]
);

// 28. Community Votes
export const communityVotes = pgTable(
  'community_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    voterHash: varchar('voter_hash', { length: 128 }).notNull(),
    ipHash: varchar('ip_hash', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_community_votes_event_voter').on(
      table.eventId,
      table.voterHash
    ),
    index('idx_community_votes_project_id').on(table.projectId),
  ]
);

// 29. Comments
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_comments_project_id').on(table.projectId),
    index('idx_comments_event_id').on(table.eventId),
  ]
);

// 30. Audit Events
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }),
    requestId: varchar('request_id', { length: 100 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_events_event_created').on(table.eventId, table.createdAt),
    index('idx_audit_events_org_created').on(table.organizationId, table.createdAt),
    index('idx_audit_events_actor').on(table.actorUserId),
    index('idx_audit_events_action').on(table.action),
  ]
);

// 31. Webhooks
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    events: jsonb('events').notNull(), // array of event action strings
    secret: text('secret').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_webhooks_event_id').on(table.eventId)]
);

// 32. Webhook Deliveries
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_webhook_deliv_webhook_id').on(table.webhookId)]
);

// 33. Certificates
export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(), // PARTICIPATION, JUDGE, WINNER
    recipientName: varchar('recipient_name', { length: 255 }).notNull(),
    projectTitle: varchar('project_title', { length: 255 }),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_certificates_event_user').on(table.eventId, table.userId),
  ]
);

// 34. Fixture Imports
export const fixtureImports = pgTable(
  'fixture_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filename: varchar('filename', { length: 255 }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull().unique(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_fixture_imports_sha256').on(table.sha256)]
);

// 35. Jobs (Asynchronous Background Job Queue)
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queue: varchar('queue', { length: 64 }).notNull().default('default'),
    name: varchar('name', { length: 128 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, RUNNING, COMPLETED, FAILED
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 128 }),
    lastError: text('last_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_jobs_status_run_at').on(table.status, table.runAt),
    index('idx_jobs_queue').on(table.queue),
  ]
);

// 36. Notifications (In-app notification system)
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(), // TEAM_INVITE, JUDGE_ASSIGNED, SUBMISSION_CONFIRMATION, RESULTS_PUBLISHED, DEADLINE_WARNING, SYSTEM
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user_read').on(table.userId, table.readAt),
    index('idx_notifications_user_created').on(table.userId, table.createdAt),
  ]
);

// 37. User MFA (TOTP Two-Factor Authentication)
export const userMfa = pgTable(
  'user_mfa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    secret: text('secret').notNull(), // base32 encoded TOTP secret
    enabled: boolean('enabled').notNull().default(false),
    backupCodes: jsonb('backup_codes'), // array of hashed backup codes
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_user_mfa_user_id').on(table.userId)]
);

// 38. API Keys (Scoped organization API credentials)
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    tokenPrefix: varchar('token_prefix', { length: 64 }).notNull(),
    scopes: jsonb('scopes').notNull(), // Array of scope strings, e.g. ["events:read", "projects:read"]
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_api_keys_org_id').on(table.organizationId),
    index('idx_api_keys_token_hash').on(table.tokenHash),
  ]
);

// 39. Custom Domains (Organization & Event custom domain routing)
export const customDomains = pgTable(
  'custom_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    hostname: varchar('hostname', { length: 255 }).notNull().unique(),
    verificationToken: varchar('verification_token', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, VERIFIED, ACTIVE, FAILED
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_custom_domains_org_id').on(table.organizationId),
    index('idx_custom_domains_hostname').on(table.hostname),
  ]
);


