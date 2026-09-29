# Comprehensive Threat Model — DOGFOOD 2026

## 1. Scope & System Assets

DOGFOOD 2026 protects the integrity, confidentiality, and availability of competitive hackathon data. The primary protected assets include:
1. **Private Judge Scores & Qualitative Reviews**: Unreleased evaluations and peer scores.
2. **Submission Integrity**: Code repositories, timestamps, and deadline compliance.
3. **Draft Leaderboards & Normalization Data**: Unannounced rankings before official publication.
4. **User & Session Credentials**: Argon2id password hashes and active session cookies.
5. **Community Ballots**: Public votes and anti-stuffing hashes.
6. **Immutable Audit Records**: System provenance and administrative event history.

---

## 2. Threat Analysis Matrix

---

### Threat 1: Unauthorized Score Access & Peer Judge Snooping
- **Asset**: Private review scores, criterion comments, and judge identities.
- **Threat**: A judge attempts to view peer reviews for an assigned project, or a participant attempts to query judge scoring endpoints to anticipate results.
- **Attacker**: Rogue judge or curious participant.
- **Attack Path**: Direct HTTP request to `GET /api/v1/judges/:judgeId/scores` or `GET /api/v1/judge/reviews/:reviewId`.
- **Mitigation**:
  - Strict server-side RBAC in `apps/api/src/policies/index.ts`.
  - The endpoint compares the route `:judgeId` parameter against the authenticated actor's ID and event role.
  - Returns `403 Forbidden` if a judge requests another judge's ID, or if a participant makes the request.
- **Residual Risk**: A compromised organizer account could inspect all scores (mitigated by immutable audit logging of organizer views).

---

### Threat 2: Submission Deadline Bypass
- **Asset**: Submission integrity and fair competition deadlines.
- **Threat**: A participant crafts a late HTTP payload after the official submission deadline to submit code or edit project details.
- **Attacker**: Participant attempting to gain an unfair time advantage.
- **Attack Path**: `POST /api/v1/events/:eventId/projects` or `PATCH /api/v1/projects/:projectId` sent after `events.submission_deadline`.
- **Mitigation**:
  - Server-side deadline validation enforced in both route pre-handlers and database write queries.
  - The server queries `event.submission_deadline` against `new Date()` and rejects requests with HTTP `409 Conflict` and code `SUBMISSION_DEADLINE_PASSED`.
  - Frontend button disabling is treated merely as UX convenience, not security.
- **Residual Risk**: Clock skew between server and NTP source (mitigated by standardized UTC timestamps and NTP synchronization).

---

### Threat 3: Session Hijacking & Session Fixation
- **Asset**: Authenticated user sessions and administrative privileges.
- **Threat**: An attacker intercepts or predicts session tokens to impersonate organizers, judges, or participants.
- **Attacker**: Network adversary or malicious script.
- **Attack Path**: XSS cookie extraction, network sniffing over insecure connections, or brute-forcing session IDs.
- **Mitigation**:
  - Sessions use high-entropy cryptographically secure pseudo-random strings (256-bit).
  - Stored with `HttpOnly; SameSite=Lax; Secure` cookie flags, preventing access from JavaScript (`document.cookie`).
  - Server-side validation against the `sessions` PostgreSQL table with expiration checks.
  - Tokens rotated upon privilege escalation.
- **Residual Risk**: Compromised client devices with root/admin access can extract cookies directly from browser storage.

---

### Threat 4: Brute-Force Password Attacks
- **Asset**: User accounts and administrative credentials.
- **Threat**: Automated password guessing attacks against organizer or judge logins.
- **Attacker**: Scripted internet bot.
- **Attack Path**: High-frequency POST requests to `/api/v1/auth/login`.
- **Mitigation**:
  - Argon2id password hashing parameters ($m=65536, t=3, p=4$) making offline and online hashing computationally expensive.
  - IP-based rate limiting via `@fastify/rate-limit` (max 5 failed attempts per minute per IP).
- **Residual Risk**: Distributed botnets rotating IPs targeting weak dictionary passwords. Mitigated by enforcing strong password complexity.

---

### Threat 5: Privilege Escalation & Role Tampering
- **Asset**: Global admin and event organizer capabilities.
- **Threat**: A regular user manipulates role parameters in requests to grant themselves organizer rights.
- **Attacker**: Authenticated participant.
- **Attack Path**: Sending `{ "role": "ORGANIZER" }` or `{ "globalRole": "ADMIN" }` in registration or profile update payloads.
- **Mitigation**:
  - Strict Zod schema validation strips unknown fields.
  - Role mutation is restricted to admin-only database services.
  - Scoped role membership verified through `event_memberships` table on every protected request.
- **Residual Risk**: Misconfigured event membership assignment by a legitimate organizer.

---

### Threat 6: Cross-Site Scripting (XSS)
- **Asset**: User browser execution environment and session state.
- **Threat**: An attacker submits malicious JavaScript in project markdown descriptions, taglines, or comments.
- **Attacker**: Malicious participant.
- **Attack Path**: Entering `<script>alert(document.domain)</script>` or `javascript:` URLs in project fields.
- **Mitigation**:
  - React automatically escapes all string interpolations in JSX.
  - Markdown rendering uses sanitized AST nodes prohibiting raw script tags.
  - External URLs (`repositoryUrl`, `demoUrl`) are strictly validated against `z.string().url()` requiring HTTP/HTTPS protocols.
- **Residual Risk**: Zero-day vulnerabilities in frontend markdown parsing libraries (mitigated by strict Content-Security-Policy headers).

---

### Threat 7: SQL Injection
- **Asset**: Entire relational database contents.
- **Threat**: Manipulating query parameters to execute arbitrary SQL commands.
- **Attacker**: Malicious external or internal actor.
- **Attack Path**: Injecting SQL syntax into search queries or URL path parameters (e.g. `' OR '1'='1`).
- **Mitigation**:
  - 100% of database queries use Drizzle ORM's parameterized query builder.
  - All input parameters are converted into parameterized SQL bind variables (`$1, $2, ...`).
  - Zero raw string concatenation in SQL queries.
  - UUID type-checking validates format prior to database query execution (`apps/api/src/lib/uuid.ts`).
- **Residual Risk**: Vulnerabilities in PostgreSQL driver itself (mitigated by keeping `pg` and Drizzle dependencies updated).

---

### Threat 8: Community Vote Stuffing & Sybil Attacks
- **Asset**: Community Choice Award integrity.
- **Threat**: A participant writes a script to cast hundreds of votes for their own project.
- **Attacker**: Dishonest participant or bot.
- **Attack Path**: Rapid automated POST requests to `/api/v1/events/:eventId/votes`.
- **Mitigation**:
  - Database-enforced uniqueness on `(event_id, voter_hash)` preventing duplicate submissions from the same user or session.
  - Client IP hashing (`ip_hash`) logged in `community_votes` for anomaly detection.
  - Rate limiting on voting endpoints.
  - Deterministic ballot ordering prevents bots from scripting top-card clicks.
- **Residual Risk**: Distributed attackers utilizing residential proxies and clearing session cookies. (Documented honestly: IP and session gating cannot guarantee 100% Sybil resistance without hard KYC).

---

### Threat 9: Duplicate Submissions & Repository Plagiarism
- **Asset**: Fair project evaluation.
- **Threat**: A team submits two slightly modified versions of the same project to increase their odds of winning or being reviewed.
- **Attacker**: Cheating team.
- **Attack Path**: Submitting multiple projects under different team members with the same GitHub repository.
- **Mitigation**:
  - Automated duplicate detection analyzer runs across all projects.
  - Flags projects sharing the same repository URL, title similarity, or identical team members with `SUSPECTED` duplicate status.
  - Surfaces duplicates directly in the Organizer Integrity Center for human review and resolution.
- **Residual Risk**: Submitting identical code hosted on two different repository URLs (mitigated by judge inspection).

---

### Threat 10: Judge Collusion & Biased Scoring
- **Asset**: Fair judging rankings.
- **Threat**: A corrupt judge awards artificially high scores to their friends' project and deflates all other projects.
- **Attacker**: Colluding judge.
- **Attack Path**: Awarding 5/5 to target project and 1/5 to others.
- **Mitigation**:
  - Empirical Bayes shrinkage mean-centering normalization deflates outlier biases based on judge calibration.
  - Conflict declaration prevents assigning judges to affiliated teams.
  - Disagreement analysis automatically flags projects with score discrepancies $\ge 1.5$.
  - Judge calibration matrix highlights judges with extreme bias ($|b_j| > 0.8$) or near-zero variance.
- **Residual Risk**: Multiple colluding judges coordinating scores (mitigated by target review redundancy $k \ge 3$).

---

### Threat 11: Pre-Publication Results Leakage
- **Asset**: Final leaderboard and prize winner announcements.
- **Threat**: An unauthenticated visitor or participant discovers winner rankings before the official closing ceremony.
- **Attacker**: Impatient participant.
- **Attack Path**: Querying `/api/v1/events/:eventId/results` prior to the organizer publishing.
- **Mitigation**:
  - The results endpoint checks `events.results_published`.
  - If `false`, non-organizer requests return HTTP `403 Forbidden` (`RESULTS_NOT_PUBLISHED`).
  - Draft normalization runs are hidden from public queries.
- **Residual Risk**: Authorized organizer leaking results verbally.

---

### Threat 12: Audit Log Tampering
- **Asset**: System accountability and event provenance.
- **Threat**: A rogue administrator attempts to delete audit logs to conceal score tampering.
- **Attacker**: Malicious internal admin.
- **Attack Path**: Executing `DELETE FROM audit_events`.
- **Mitigation**:
  - `audit_events` table contains no update or delete endpoints in the API.
  - All audit writes are append-only.
  - Export functionality allows archiving logs off-server.
- **Residual Risk**: Direct superuser access to the PostgreSQL database container.
