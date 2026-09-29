# Security Policy

DOGFOOD is designed as high-integrity infrastructure for running competitive hackathons and allocating capital, awards, and credentials. Security, tenant isolation, and auditability are foundational to the project.

---

## Supported Versions

| Version | Supported          | Security Notes |
| ------- | ------------------ | -------------- |
| 2.x     | :white_check_mark: | Active production releases |
| 1.x     | :warning:          | Baseline challenge reference |

---

## Reporting a Vulnerability

We deeply appreciate the efforts of security researchers and community members in helping maintain the security and privacy of DOGFOOD users.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security issues using one of the following methods:

1. **GitHub Private Security Advisory**: Use the "Report a vulnerability" button on our GitHub repository under the **Security** tab.
2. **Security Email**: Send an encrypted email to `security@dogfood.example` (or the repository maintainers).

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:
- A detailed description of the vulnerability and its potential impact.
- Clear reproduction steps or a minimal proof-of-concept (PoC).
- The affected component (e.g., API route, authentication flow, judging engine, database query).
- Suggested mitigations or fixes, if available.

### Disclosure Timeline

- **Acknowledgment**: We aim to acknowledge receipt of your report within 48 hours.
- **Triage & Fix**: We will validate the issue, determine its severity, and provide regular updates on our progress toward a fix (typically within 7 to 14 days).
- **Public Disclosure**: We coordinate public disclosure with the reporter after a patch has been released, adhering to a 90-day responsible disclosure window.

---

## Built-In Security Architecture

DOGFOOD implements several layers of defense-in-depth:

### 1. Authentication & Session Security
- **Password Hashing**: Industry-standard **Argon2id** (memory cost 64MB, time cost 3, parallelism 1).
- **Multi-Factor Authentication (MFA)**: Standards-compliant **RFC 6238 TOTP** with SHA-1/SHA-256 HMAC and single-use cryptographic recovery backup codes.
- **Server-Side Sessions**: Stored in PostgreSQL with automatic session identifier rotation upon authentication to prevent session fixation.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax`, and `Secure` (enforced automatically in production environments).
- **Session Revocation**: One-click "Sign out all devices" endpoint.

### 2. Multi-Tenant Authorization & Role Isolation
- **PostgreSQL-Level Verification**: Organization IDs supplied in request payloads or query parameters are never trusted. All access checks verify user memberships and roles directly in PostgreSQL (`authorizeOrgMember`).
- **Separation of Organization and Event Roles**: Organization roles (`OWNER`, `ADMIN`, `MEMBER`) and Event roles (`ORGANIZER`, `JUDGE`, `PARTICIPANT`) are strictly decoupled.
- **Judge Isolation**: Blind judging prevents cross-judge score leakage. Reviewers cannot view scores from other judges until the competition organizers officially publish calibrated results.

### 3. Attack Surface Hardening
- **Content Security Policy (CSP)**: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.
- **Cross-Origin Framing**: `X-Frame-Options: DENY` prevents clickjacking.
- **MIME Sniffing**: `X-Content-Type-Options: nosniff`.
- **CSRF Defense**: Origin and Referer validation on state-changing requests, combined with SameSite cookie policies.
- **Content Sanitization**: Markdown and user-submitted text descriptions are sanitized before rendering or storage to prevent stored Cross-Site Scripting (XSS).
- **Deterministic Token Hashes**: API keys and webhook secrets are stored only as SHA-256 hashes. Full secret tokens are displayed exactly once at generation.
- **HMAC Signatures**: Outgoing webhooks are cryptographically signed with HMAC-SHA256 (`X-Dogfood-Signature-256`) with timestamps and delivery UUIDs to prevent replay attacks.
- **Audit Trails**: All administrative, judging, membership, and publication actions generate immutable audit log records.
