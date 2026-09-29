export const MIGRATIONS_SQL = `
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(50),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  avatar_path TEXT,
  global_role VARCHAR(20) NOT NULL DEFAULT 'USER',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_source_id ON users(source_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

-- 2. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  raw_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_raw_token ON sessions(raw_token);

-- 2b. Auth Identities
CREATE TABLE IF NOT EXISTS auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(255),
  provider_email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider ON auth_identities(provider, provider_user_id);

-- 2c. Email Verification Tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token_hash);

-- 2d. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);

-- 2e. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  logo_object_id VARCHAR(255),
  website VARCHAR(255),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- 2f. Organization Memberships
CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON organization_memberships(organization_id);

-- 3. Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source_id VARCHAR(50),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  event_starts_at TIMESTAMPTZ,
  event_ends_at TIMESTAMPTZ,
  submission_deadline TIMESTAMPTZ NOT NULL,
  judging_starts_at TIMESTAMPTZ,
  judging_ends_at TIMESTAMPTZ,
  results_publish_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  community_voting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  results_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_organization_id ON events(organization_id);

-- Backfill demo organization for unlinked events
INSERT INTO organizations (slug, name, description)
VALUES ('dogfood-demo', 'DOGFOOD Demo Organization', 'Official organization running the DOGFOOD challenge.')
ON CONFLICT (slug) DO NOTHING;

UPDATE events
SET organization_id = (SELECT id FROM organizations WHERE slug = 'dogfood-demo')
WHERE organization_id IS NULL;

INSERT INTO organization_memberships (organization_id, user_id, role, status)
SELECT o.id, u.id, 'OWNER', 'ACTIVE'
FROM organizations o
JOIN users u ON (u.source_id = 'usr_organizer' OR u.global_role = 'ADMIN')
WHERE o.slug = 'dogfood-demo'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. Event Memberships
CREATE TABLE IF NOT EXISTS event_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_user UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_memberships_role ON event_memberships(role);

-- 5. Tracks
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(50),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracks_event_id ON tracks(event_id);
CREATE INDEX IF NOT EXISTS idx_tracks_source_id ON tracks(source_id);

-- 6. Prizes
CREATE TABLE IF NOT EXISTS prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  amount VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prizes_event_id ON prizes(event_id);

-- 7. Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(50),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_source_id ON teams(source_id);

-- 8. Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_user UNIQUE (team_id, user_id)
);

-- 9. Team Invites
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(50),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  tagline VARCHAR(255) DEFAULT '',
  summary TEXT DEFAULT '',
  description TEXT DEFAULT '',
  repository_url TEXT,
  demo_url TEXT,
  video_url TEXT,
  thumbnail_path TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
  submitted_at TIMESTAMPTZ,
  duplicate_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  duplicate_of UUID,
  source_type VARCHAR(32) NOT NULL DEFAULT 'REAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) NOT NULL DEFAULT 'REAL';
UPDATE projects SET source_type = 'FIXTURE' WHERE source_id IS NOT NULL AND source_type = 'REAL';
CREATE INDEX IF NOT EXISTS idx_projects_event_id ON projects(event_id);
CREATE INDEX IF NOT EXISTS idx_projects_source_id ON projects(source_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_track_id ON projects(track_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 11. Project Tracks
CREATE TABLE IF NOT EXISTS project_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT uq_project_track UNIQUE (project_id, track_id)
);

-- 12. Project Assets
CREATE TABLE IF NOT EXISTS project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploader_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  path TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  size_bytes INT,
  storage_key TEXT,
  mime_type VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS uploader_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON project_assets(project_id);

-- 13. Submission Questions
CREATE TABLE IF NOT EXISTS submission_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  options JSONB,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_submission_questions_event_id ON submission_questions(event_id);

-- 14. Submission Answers
CREATE TABLE IF NOT EXISTS submission_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES submission_questions(id) ON DELETE CASCADE,
  answer JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_question UNIQUE (project_id, question_id)
);

-- 15. Rubrics
CREATE TABLE IF NOT EXISTS rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rubrics_event_id ON rubrics(event_id);

-- 16. Rubric Criteria
CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key VARCHAR(100),
  description TEXT DEFAULT '',
  min_score INT NOT NULL DEFAULT 1,
  max_score INT NOT NULL DEFAULT 5,
  weight DOUBLE PRECISION NOT NULL,
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric_id ON rubric_criteria(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_key ON rubric_criteria(key);

-- 17. Judge Profiles
CREATE TABLE IF NOT EXISTS judge_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  bio TEXT DEFAULT '',
  max_workload INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_judge_profile UNIQUE (event_id, user_id)
);

-- 18. Judge Track Preferences
CREATE TABLE IF NOT EXISTS judge_track_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  CONSTRAINT uq_judge_track_pref UNIQUE (judge_user_id, event_id, track_id)
);

-- 19. Judge Conflicts
CREATE TABLE IF NOT EXISTS judge_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  reason VARCHAR(255) DEFAULT 'Conflict of interest'
);
CREATE INDEX IF NOT EXISTS idx_judge_conflicts_judge_event ON judge_conflicts(judge_user_id, event_id);

-- 20. Judge Assignments
CREATE TABLE IF NOT EXISTS judge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  judge_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_judge_project_assignment UNIQUE (judge_user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_event ON judge_assignments(judge_user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_project ON judge_assignments(project_id);

-- 21. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  judge_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  raw_score DOUBLE PRECISION,
  overall_comment TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_review_project_judge UNIQUE (project_id, judge_user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_judge_event ON reviews(judge_user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id);

-- 22. Review Scores
CREATE TABLE IF NOT EXISTS review_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  comment TEXT DEFAULT '',
  CONSTRAINT uq_review_criterion_score UNIQUE (review_id, criterion_id)
);
CREATE INDEX IF NOT EXISTS idx_review_scores_review_id ON review_scores(review_id);

-- 23. Normalization Runs
CREATE TABLE IF NOT EXISTS normalization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  algorithm VARCHAR(100) NOT NULL DEFAULT 'MEAN_CENTERING_SHRINKAGE',
  algorithm_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  parameters JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_norm_runs_event_id ON normalization_runs(event_id);

-- 24. Normalized Reviews
CREATE TABLE IF NOT EXISTS normalized_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalization_run_id UUID NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  raw_score DOUBLE PRECISION NOT NULL,
  judge_mean DOUBLE PRECISION NOT NULL,
  global_mean DOUBLE PRECISION NOT NULL,
  observed_bias DOUBLE PRECISION NOT NULL,
  shrinkage_factor DOUBLE PRECISION NOT NULL,
  adjusted_bias DOUBLE PRECISION NOT NULL,
  normalized_score DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_norm_reviews_run_id ON normalized_reviews(normalization_run_id);
CREATE INDEX IF NOT EXISTS idx_norm_reviews_review_id ON normalized_reviews(review_id);

-- 25. Project Results
CREATE TABLE IF NOT EXISTS project_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalization_run_id UUID NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raw_average DOUBLE PRECISION NOT NULL,
  normalized_average DOUBLE PRECISION NOT NULL,
  review_count INT NOT NULL,
  raw_rank INT NOT NULL,
  normalized_rank INT NOT NULL,
  rank_shift INT NOT NULL DEFAULT 0,
  is_tied BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_project_result_run_project UNIQUE (normalization_run_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_project_results_norm_rank ON project_results(normalized_rank);

-- 26. Judge Statistics
CREATE TABLE IF NOT EXISTS judge_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalization_run_id UUID NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE,
  judge_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_count INT NOT NULL,
  completion_rate DOUBLE PRECISION NOT NULL,
  mean DOUBLE PRECISION NOT NULL,
  median DOUBLE PRECISION NOT NULL,
  variance DOUBLE PRECISION NOT NULL,
  standard_deviation DOUBLE PRECISION NOT NULL,
  minimum DOUBLE PRECISION NOT NULL,
  maximum DOUBLE PRECISION NOT NULL,
  observed_bias DOUBLE PRECISION NOT NULL,
  adjusted_bias DOUBLE PRECISION NOT NULL,
  shrinkage_factor DOUBLE PRECISION NOT NULL,
  flags JSONB NOT NULL,
  CONSTRAINT uq_judge_stats_run_judge UNIQUE (normalization_run_id, judge_user_id)
);

-- 27. Project Coverage
CREATE TABLE IF NOT EXISTS project_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalization_run_id UUID NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actual_reviews INT NOT NULL,
  target_reviews INT NOT NULL,
  coverage_ratio DOUBLE PRECISION NOT NULL,
  coverage_status VARCHAR(30) NOT NULL,
  is_high_disagreement BOOLEAN NOT NULL DEFAULT FALSE,
  score_range DOUBLE PRECISION,
  CONSTRAINT uq_project_coverage_run_project UNIQUE (normalization_run_id, project_id)
);

-- 28. Community Votes
CREATE TABLE IF NOT EXISTS community_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  voter_hash VARCHAR(128) NOT NULL,
  ip_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_vote_event_voter UNIQUE (event_id, voter_hash)
);
CREATE INDEX IF NOT EXISTS idx_community_votes_project_id ON community_votes(project_id);

-- 29. Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_event_id ON comments(event_id);

-- 30. Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  request_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_event_created ON audit_events(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON audit_events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);

-- 31. Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events JSONB NOT NULL,
  secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_event_id ON webhooks(event_id);

-- 32. Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_webhook_id ON webhook_deliveries(webhook_id);

-- 33. Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  project_title VARCHAR(255),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificates_event_user ON certificates(event_id, user_id);

-- 34. Fixture Imports
CREATE TABLE IF NOT EXISTS fixture_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  sha256 VARCHAR(64) NOT NULL UNIQUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fixture_imports_sha256 ON fixture_imports(sha256);

-- 35. Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(128),
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(queue);

-- 36. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);

-- 37. User MFA
CREATE TABLE IF NOT EXISTS user_mfa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  backup_codes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id);

-- 38. API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix VARCHAR(64) NOT NULL,
  scopes JSONB NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE api_keys ALTER COLUMN token_prefix TYPE VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_token_hash ON api_keys(token_hash);

-- 39. Custom Domains
CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  hostname VARCHAR(255) NOT NULL UNIQUE,
  verification_token VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_domains_org_id ON custom_domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_hostname ON custom_domains(hostname);
`;

