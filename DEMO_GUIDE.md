# DOGFOOD 2026 — 5-Minute Demo Video Walkthrough Guide

**Event**: DOGFOOD 2026 Hackathon (Hackathon Raptors)  
**Theme**: *"Build the platform that will judge you."*  
**Format**: 5-Minute Video Walkthrough (`00:00` to `05:00`)  
**Resolution**: 1080p (1920x1080) @ 60fps  
**Local Port**: `http://localhost:8080` (or `http://localhost:5173` with dev API on `8080`)  

---

## 🎬 Video Production Breakdown

| Timestamp | Segment Title | On-Screen Action | Core Talking Point |
| :---: | :--- | :--- | :--- |
| **00:00 – 00:45** | **The Hook & Zero-Dependency Boot** | Terminal running `docker compose up`, then opening browser to `http://localhost:8080`. | *"Welcome to DOGFOOD 2026, where we built the platform that will judge us. Zero cloud dependencies, booted with a single command."* |
| **00:45 – 01:45** | **Public Gallery & Participant Journey** | Browsing the Gallery, opening a project modal, testing the offline demo sandbox, switching to Participant persona. | *"The gallery is completely public and offline-capable. Real projects render rich media, while fixture projects load in sandboxes."* |
| **01:45 – 02:45** | **Judge Isolation & Rubric Scoring** | Switching to Judge A (Tomas), scoring a project across weighted criteria, showing that Judge B's scores are completely invisible. | *"Blind judging isolation: judges score independently against weighted rubrics without cross-judge score leakage or anchoring."* |
| **02:45 – 03:45** | **Organizer Integrity Center & Normalization Math** | Switching to Organizer persona, opening Integrity Center, triggering Empirical Bayes Normalization run, viewing live audit log. | *"Empirical Bayes shrinkage solves harsh vs lenient grading and zero-variance constant scorers mathematically. Every run is audited and reproducible."* |
| **03:45 – 04:30** | **Enterprise Upgrades & Security** | Showing Dark/Light theme toggle, multi-tenant Organizations page, TOTP MFA in Account Settings. | *"Industrial-grade design: minimal aesthetics, zero neon lights, multi-tenancy, and RFC 6238 TOTP authentication."* |
| **04:30 – 05:00** | **Automated Acceptance & Wrap-up** | Terminal running `python run.py .dogfood.toml` (all PASS), concluding pitch. | *"100% compliant with the Hackathon Raptors acceptance suite. DOGFOOD is production-ready open-source infrastructure for developer competitions."* |

---

## 🎙️ Minute-by-Minute Script & Voiceover

### Segment 1: The Hook & Single-Command Boot (00:00 – 00:45)

**Visual**:
1. Show terminal window.
2. Execute command:
   ```bash
   docker compose up
   ```
3. Watch PostgreSQL 17, Fastify API, and Caddy reverse proxy spin up cleanly.
4. Switch to browser at `http://localhost:8080`.

**Voiceover Script**:
> *"Hello Hackathon Raptors judges! Welcome to our submission for DOGFOOD 2026: 'Build the platform that will judge you.'*  
> *When we set out to build this platform, we embraced the challenge literally: we built industrial-grade, auditable infrastructure designed to judge us fairly, transparently, and with zero external dependencies.*  
> *Notice right here in my terminal—the entire platform boots up locally with a single command: `docker compose up`. There are no external cloud services, no third-party auth providers, and no internet access required. The database, backend API, Caddy reverse proxy, and compiled React application all initialize deterministically."*

---

### Segment 2: Public Gallery & Participant Experience (00:45 – 01:45)

**Visual**:
1. Navigate to **Gallery** (`/gallery`).
2. Search and filter by track (e.g., "Developer Tools", "AI/ML").
3. Click on project `prj_01` (*"Smart Admissions Predictor"*).
4. Click **"Open Live Demo Sandbox"** to demonstrate the internal offline fixture sandbox.
5. In the top demo banner, switch to **Participant (Lucas)** and visit the **Participant Dashboard** (`/participant`).

**Voiceover Script**:
> *"Here on the Public Gallery, unauthenticated visitors can explore every accepted hackathon submission with rich metadata, tags, and repo links.*  
> *Because developer competitions often have dead external demo links, we built an integrated live sandbox that previews projects safely and offline.*  
> *Switching to the Participant view, teams can edit their draft submissions, upload screenshots, declare team members, and monitor their review status in real time before the deadline locks."*

---

### Segment 3: Blind Judging & Cryptographic Isolation (01:45 – 02:45)

**Visual**:
1. Switch to **Judge A (Tomas)** using the persona banner.
2. Visit the **Judge Portal** (`/judge`).
3. Click **"Evaluate Project"** on an assigned submission.
4. Adjust sliders across the weighted rubric criteria (Technical Merit, Innovation, Execution, Presentation).
5. Add private evaluator notes and save the evaluation.
6. Open Developer Tools / Network tab to demonstrate that **Judge B's scores are completely absent from the API response**.

**Voiceover Script**:
> *"Now for the core of the challenge: the judging engine.*  
> *Logging in as Judge A, we enter the Judge Portal. Notice that judges only see their own assigned queue. The rubric criteria are dynamically weighted—Technical Merit, Innovation, Execution, and Polish.*  
> *Critically, judge isolation is enforced at the database query level. Judge A cannot see Judge B's scores, notes, or identity. This eliminates anchor bias, herd mentality, and collusion during the active evaluation window."*

---

### Segment 4: Organizer Integrity Center & Empirical Bayes Normalization (02:45 – 03:45)

**Visual**:
1. Switch to **Organizer** persona.
2. Navigate to **Integrity Center** (`/organizer`).
3. Point out the real-time scoring progress, judge completion rates, and variance metrics.
4. Click **"Run Normalization (Empirical Bayes)"**.
5. Show the resulting project ranking table with delta rank changes and normalized scores.
6. Show the **Audit Log** tab displaying immutable cryptographic trail records.

**Voiceover Script**:
> *"Now, let's step into the Organizer's Integrity Center. This is where DOGFOOD sets a new industry standard.*  
> *In any hackathon, some judges are notoriously harsh while others give all 5s. Standard averages penalize projects with strict judges. Instead, our standalone `@dogfood/judging-engine` applies Empirical Bayes shrinkage mean-centering normalization.*  
> *By computing judge bias with a sample-size shrinkage factor, we neutralize grading leniency without distorting small sample sizes. If a judge scores everything identically, our constant-scorer detector catches the zero variance and handles it gracefully.*  
> *Every calculation is versioned, immutable, and exported directly into an auditable CSV."*

---

### Segment 5: Enterprise Upgrades: Multi-Tenancy, Theme & Security (03:45 – 04:30)

**Visual**:
1. Click the **Theme Toggle** (sun/moon icon) to smoothly toggle between Light Mode and Dark Mode.
2. Click **"Organizations"** in the navigation bar (`/organizations`) to show multi-tenant workspaces.
3. Open **Account Settings Modal** to show RFC 6238 TOTP Two-Factor Authentication (MFA) setup and session revocation.

**Voiceover Script**:
> *"We didn't just build a hackathon prototype—we built production-ready open-source infrastructure.*  
> *The UI features a clean, minimal aesthetic with zero tacky neon lights, featuring full system Dark and Light mode support.*  
> *Organizations can self-host this as a single instance or operate it as a multi-tenant platform for multiple universities or corporate challenges.*  
> *Security is first-class: Argon2id password hashing, RFC 6238 TOTP two-factor authentication, and centralized RBAC policies."*

---

### Segment 6: Challenge Acceptance Test Verification & Wrap-up (04:30 – 05:00)

**Visual**:
1. Bring the terminal back to center stage.
2. Run the official acceptance checker:
   ```bash
   python run.py .dogfood.toml
   ```
3. Show the output: `claimed T1 T2, verified T1 T2` (all PASS).
4. Run `pnpm test` showing all 82 Vitest tests passing.
5. End on the DOGFOOD 2026 homepage with closing title card.

**Voiceover Script**:
> *"To prove strict compliance with the Hackathon Raptors challenge specifications, let's run the official acceptance suite: `python run.py .dogfood.toml`.*  
> *All Tier 1 and Tier 2 checks pass flawlessly: public gallery, fixture ingestion, deadline rejection, judge isolation, peer score blindness, participant blocking, and CSV export.*  
> *And our internal test suite passes all 82 unit and integration tests.*  
> *Thank you to Hackathon Raptors for an incredible hackathon theme. We've built the platform that will judge us—and we are proud to stand behind its integrity. Thank you!"*

---

## 💡 Recording Checklist for the Presenter

- [ ] **Docker Engine**: Running locally with no network connection required.
- [ ] **Browser Zoom**: Set to 100% or 110% for crisp typography on 1080p recording.
- [ ] **Terminal Font Size**: Set to 16pt–18pt so text is easily readable on mobile viewers.
- [ ] **Audio Setup**: Clear microphone, minimal echo, no background music overpowering voiceover.
- [ ] **Timer**: Keep OBS or stopwatch visible off-screen to ensure the final recording is under 5 minutes.
