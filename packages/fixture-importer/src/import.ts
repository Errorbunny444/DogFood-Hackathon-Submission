import fs from 'node:fs';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  users,
  events,
  organizations,
  organizationMemberships,
  eventMemberships,
  tracks,
  teams,
  teamMembers,
  projects,
  rubrics,
  rubricCriteria,
  judgeProfiles,
  judgeTrackPreferences,
  reviews,
  reviewScores,
  normalizationRuns,
  normalizedReviews,
  projectResults,
  judgeStatistics,
  projectCoverage,
  fixtureImports,
  auditEvents,
} from '@dogfood/database';
import {
  calculateRawReviewScore,
  runJudgingNormalization,
  calculateProjectCoverage,
  calculateProjectDisagreement,
} from '@dogfood/judging-engine';
import { fixtureFileSchema, FixtureFile } from './validate.js';
import { detectDuplicates } from './duplicate-detection.js';
import { seedAcceptanceSessions, AcceptanceSeedResult } from './seed-sessions.js';

export interface ImportOptions {
  fixturePath: string;
  forceReimport?: boolean;
}

export interface ImportResult {
  skipped: boolean;
  sha256: string;
  eventId: string;
  eventSourceId: string;
  counts: {
    tracks: number;
    judges: number;
    teams: number;
    projects: number;
    reviews: number;
  };
  acceptance: AcceptanceSeedResult;
}

export async function importFixtures(
  db: any,
  options: ImportOptions
): Promise<ImportResult> {
  const content = fs.readFileSync(options.fixturePath, 'utf-8');
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');

  // Check fixture_imports for idempotency
  const [existingImport] = await db
    .select()
    .from(fixtureImports)
    .where(eq(fixtureImports.sha256, sha256))
    .limit(1);

  if (existingImport && !options.forceReimport) {
    const [existingEvent] = await db
      .select()
      .from(events)
      .where(eq(events.sourceId, 'evt_01'))
      .limit(1);

    if (existingEvent) {
      const acceptance = await seedAcceptanceSessions(db, existingEvent.id);
      return {
        skipped: true,
        sha256,
        eventId: existingEvent.id,
        eventSourceId: existingEvent.sourceId || 'evt_01',
        counts: { tracks: 8, judges: 30, teams: 40, projects: 41, reviews: 126 },
        acceptance,
      };
    }
  }

  // Parse and validate fixture file
  const rawData = JSON.parse(content);
  const data: FixtureFile = fixtureFileSchema.parse(rawData);

  // Ensure default demo organization exists for fixture event
  let [demoOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'dogfood-demo'))
    .limit(1);

  if (!demoOrg) {
    [demoOrg] = await db
      .insert(organizations)
      .values({
        name: 'DOGFOOD Demo Organization',
        slug: 'dogfood-demo',
        description: 'Official organization running the DOGFOOD challenge.',
      })
      .returning();
  }

  // 1. Create Event
  let [eventRecord] = await db
    .select()
    .from(events)
    .where(eq(events.sourceId, data.event.id))
    .limit(1);

  if (!eventRecord) {
    [eventRecord] = await db
      .insert(events)
      .values({
        organizationId: demoOrg.id,
        sourceId: data.event.id,
        slug: 'sample-hack-2026',
        name: data.event.name,
        description: 'Sample Hackathon loaded from official DOGFOOD fixtures.',
        timezone: 'UTC',
        submissionDeadline: new Date(data.event.submissions_close),
        status: 'SUBMISSIONS_CLOSED',
        communityVotingEnabled: true,
        commentsEnabled: true,
        resultsPublished: true,
      })
      .returning();
  } else if (!eventRecord.organizationId) {
    await db
      .update(events)
      .set({ organizationId: demoOrg.id })
      .where(eq(events.id, eventRecord.id));
  }

  const eventId = eventRecord.id;

  // 2. Create Tracks
  const trackMap = new Map<string, string>(); // sourceId -> uuid
  for (const t of data.tracks) {
    let [rec] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.sourceId, t.id))
      .limit(1);

    if (!rec) {
      [rec] = await db
        .insert(tracks)
        .values({
          sourceId: t.id,
          eventId,
          name: t.name,
          description: `Track: ${t.name}`,
        })
        .returning();
    }
    trackMap.set(t.id, rec.id);
  }

  // 3. Create Rubric & Criteria dynamically from fixture scores
  const criteriaSet = new Set<string>();
  for (const s of data.scores) {
    for (const key of Object.keys(s.criteria)) {
      criteriaSet.add(key);
    }
  }

  const distinctCriteria = Array.from(criteriaSet);
  const criterionWeight = 1.0 / distinctCriteria.length;

  let [rubricRecord] = await db
    .select()
    .from(rubrics)
    .where(eq(rubrics.eventId, eventId))
    .limit(1);

  if (!rubricRecord) {
    [rubricRecord] = await db
      .insert(rubrics)
      .values({
        eventId,
        name: 'Standard Evaluation Rubric',
        description: 'Dynamically generated weighted rubric matching fixture criteria.',
        version: 1,
        active: true,
      })
      .returning();
  }

  const criterionMap = new Map<string, { id: string; weight: number }>();
  for (let i = 0; i < distinctCriteria.length; i++) {
    const key = distinctCriteria[i];
    let [cRec] = await db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.key, key))
      .limit(1);

    if (!cRec) {
      const displayName = key.charAt(0).toUpperCase() + key.slice(1);
      [cRec] = await db
        .insert(rubricCriteria)
        .values({
          rubricId: rubricRecord.id,
          name: displayName,
          key,
          description: `Assessment of ${key}`,
          minScore: 1,
          maxScore: 5,
          weight: criterionWeight,
          position: i + 1,
        })
        .returning();
    }
    criterionMap.set(key, { id: cRec.id, weight: cRec.weight });
  }

  // 4. Create Judges & Profiles
  const judgeUserMap = new Map<string, string>(); // judge sourceId -> user uuid
  for (const j of data.judges) {
    let [userRec] = await db
      .select()
      .from(users)
      .where(eq(users.sourceId, j.id))
      .limit(1);

    if (!userRec) {
      [userRec] = await db
        .insert(users)
        .values({
          sourceId: j.id,
          email: j.email,
          passwordHash: 'dummy_hash_for_test_identities',
          displayName: j.name,
          globalRole: 'USER',
          status: 'ACTIVE',
        })
        .returning();
    }
    judgeUserMap.set(j.id, userRec.id);

    // Event Membership
    await db
      .insert(eventMemberships)
      .values({
        eventId,
        userId: userRec.id,
        role: 'JUDGE',
        status: 'ACTIVE',
      })
      .onConflictDoNothing();

    // Judge Profile
    await db
      .insert(judgeProfiles)
      .values({
        eventId,
        userId: userRec.id,
        bio: `Judge for ${j.name}`,
        maxWorkload: 15,
      })
      .onConflictDoNothing();

    // Track Preferences
    for (const trkId of j.tracks) {
      const trackUuid = trackMap.get(trkId);
      if (trackUuid) {
        await db
          .insert(judgeTrackPreferences)
          .values({
            eventId,
            judgeUserId: userRec.id,
            trackId: trackUuid,
          })
          .onConflictDoNothing();
      }
    }
  }

  // 5. Create Teams & Members
  const teamMap = new Map<string, string>(); // team sourceId -> uuid
  for (const tm of data.teams) {
    let [teamRec] = await db
      .select()
      .from(teams)
      .where(eq(teams.sourceId, tm.id))
      .limit(1);

    if (!teamRec) {
      const slug = tm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      [teamRec] = await db
        .insert(teams)
        .values({
          sourceId: tm.id,
          eventId,
          name: tm.name,
          slug,
        })
        .returning();
    }
    teamMap.set(tm.id, teamRec.id);

    // Members
    for (const memEmail of tm.members) {
      let [memUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, memEmail))
        .limit(1);

      if (!memUser) {
        const displayName = memEmail
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
        [memUser] = await db
          .insert(users)
          .values({
            email: memEmail,
            passwordHash: 'dummy_hash_for_test_identities',
            displayName,
            globalRole: 'USER',
            status: 'ACTIVE',
          })
          .returning();
      }

      await db
        .insert(eventMemberships)
        .values({
          eventId,
          userId: memUser.id,
          role: 'PARTICIPANT',
          status: 'ACTIVE',
        })
        .onConflictDoNothing();

      await db
        .insert(teamMembers)
        .values({
          teamId: teamRec.id,
          userId: memUser.id,
          role: 'MEMBER',
        })
        .onConflictDoNothing();
    }
  }

  // 6. Create Projects
  const projectMap = new Map<string, string>(); // project sourceId -> uuid
  const projectCandidates: {
    id: string;
    sourceId: string;
    teamId: string;
    teamSourceId: string;
    title: string;
    repositoryUrl: string;
    summary: string;
    submittedAt: string;
  }[] = [];

  for (const p of data.projects) {
    let [pRec] = await db
      .select()
      .from(projects)
      .where(eq(projects.sourceId, p.id))
      .limit(1);

    const teamUuid = teamMap.get(p.team);
    const trackUuid = trackMap.get(p.track);
    const submittedAt = p.submitted_at ? new Date(p.submitted_at) : new Date('2026-03-01T12:00:00Z');

    if (!pRec) {
      [pRec] = await db
        .insert(projects)
        .values({
          sourceId: p.id,
          eventId,
          teamId: teamUuid,
          trackId: trackUuid,
          title: p.title,
          summary: p.summary || '',
          description: `Full submission for ${p.title}`,
          repositoryUrl: p.repo_url || '',
          demoUrl: p.repo_url ? `${p.repo_url}/demo` : '',
          sourceType: 'FIXTURE',
          status: 'SUBMITTED',
          submittedAt,
        })
        .returning();
    } else if (pRec.sourceType !== 'FIXTURE') {
      await db.update(projects).set({ sourceType: 'FIXTURE' }).where(eq(projects.id, pRec.id));
    }
    projectMap.set(p.id, pRec.id);
    projectCandidates.push({
      id: pRec.id,
      sourceId: p.id,
      teamId: teamUuid || '',
      teamSourceId: p.team,
      title: p.title,
      repositoryUrl: p.repo_url || '',
      summary: p.summary || '',
      submittedAt: submittedAt.toISOString(),
    });
  }

  // 7. Run Duplicate Detection & Flag Suspected Duplicates
  const detectedDuplicates = detectDuplicates(projectCandidates);
  for (const dup of detectedDuplicates) {
    await db
      .update(projects)
      .set({
        duplicateStatus: 'SUSPECTED',
        duplicateOf: dup.duplicateOfId,
      })
      .where(eq(projects.id, dup.projectId));
  }

  // 8. Create Reviews & Review Scores from fixture data
  const rawReviewsForEngine: {
    reviewId: string;
    judgeUserId: string;
    projectId: string;
    rawScore: number;
  }[] = [];

  const criteriaWeightArray = Array.from(criterionMap.entries()).map(([k, v]) => ({
    criterionId: v.id,
    weight: v.weight,
  }));

  for (const s of data.scores) {
    const judgeUserId = judgeUserMap.get(s.judge);
    const projectUuid = projectMap.get(s.project);
    if (!judgeUserId || !projectUuid) continue;

    // Build criterion scores
    const criterionScores: { criterionId: string; score: number }[] = [];
    for (const [cKey, cVal] of Object.entries(s.criteria)) {
      const critInfo = criterionMap.get(cKey);
      if (critInfo) {
        criterionScores.push({ criterionId: critInfo.id, score: cVal });
      }
    }

    const rawScore = calculateRawReviewScore(criterionScores, criteriaWeightArray);

    let [revRec] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.projectId, projectUuid))
      .limit(1);

    // Check if review by this judge for this project already exists
    const [existingRev] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.projectId, projectUuid))
      .where(eq(reviews.judgeUserId, judgeUserId))
      .limit(1);

    let currentReviewId = existingRev?.id;

    if (!existingRev) {
      const [newRev] = await db
        .insert(reviews)
        .values({
          eventId,
          projectId: projectUuid,
          judgeUserId,
          rubricId: rubricRecord.id,
          status: 'SUBMITTED',
          rawScore,
          overallComment: s.comment || '',
          submittedAt: new Date('2026-03-01T17:30:00Z'),
        })
        .returning();
      currentReviewId = newRev.id;
    }

    if (currentReviewId) {
      // Insert individual criterion scores
      for (const cs of criterionScores) {
        await db
          .insert(reviewScores)
          .values({
            reviewId: currentReviewId,
            criterionId: cs.criterionId,
            score: cs.score,
          })
          .onConflictDoNothing();
      }

      rawReviewsForEngine.push({
        reviewId: currentReviewId,
        judgeUserId,
        projectId: projectUuid,
        rawScore,
      });
    }
  }

  // 9. Seed Acceptance Test Sessions
  const acceptance = await seedAcceptanceSessions(db, eventId);

  // 10. Run Initial Normalization Run & Compute Results
  const allProjectUuids = Array.from(projectMap.values());
  const normOutput = runJudgingNormalization(rawReviewsForEngine, allProjectUuids, 5);

  const [normRun] = await db
    .insert(normalizationRuns)
    .values({
      eventId,
      algorithm: 'MEAN_CENTERING_SHRINKAGE',
      algorithmVersion: '1.0',
      parameters: { shrinkageK: 5 },
      createdBy: acceptance.organizer.userId,
    })
    .returning();

  // Save Normalized Reviews
  for (const nr of normOutput.normalizedReviews) {
    await db.insert(normalizedReviews).values({
      normalizationRunId: normRun.id,
      reviewId: nr.reviewId,
      rawScore: nr.rawScore,
      judgeMean: nr.judgeMean,
      globalMean: nr.globalMean,
      observedBias: nr.observedBias,
      shrinkageFactor: nr.shrinkageFactor,
      adjustedBias: nr.adjustedBias,
      normalizedScore: nr.normalizedScore,
    });
  }

  // Save Judge Statistics
  for (const [jId, jStat] of normOutput.judgeStats.entries()) {
    await db.insert(judgeStatistics).values({
      normalizationRunId: normRun.id,
      judgeUserId: jId,
      reviewCount: jStat.reviewCount,
      completionRate: jStat.completionRate,
      mean: jStat.mean,
      median: jStat.median,
      variance: jStat.variance,
      standardDeviation: jStat.standardDeviation,
      minimum: jStat.min,
      maximum: jStat.max,
      observedBias: jStat.observedBias,
      adjustedBias: jStat.adjustedBias,
      shrinkageFactor: jStat.shrinkageFactor,
      flags: jStat.flags,
    });
  }

  // Save Project Results & Coverage
  const projectScoresByProject = new Map<string, number[]>();
  for (const r of rawReviewsForEngine) {
    const list = projectScoresByProject.get(r.projectId) || [];
    list.push(r.rawScore);
    projectScoresByProject.set(r.projectId, list);
  }

  for (const [pId, pScore] of normOutput.projectScores.entries()) {
    await db.insert(projectResults).values({
      normalizationRunId: normRun.id,
      projectId: pId,
      rawAverage: pScore.rawAverage,
      normalizedAverage: pScore.normalizedAverage,
      reviewCount: pScore.reviewCount,
      rawRank: pScore.rawRank,
      normalizedRank: pScore.normalizedRank,
      rankShift: pScore.rankShift,
      isTied: false,
    });

    const scoresList = projectScoresByProject.get(pId) || [];
    const coverage = calculateProjectCoverage(pScore.reviewCount, 3);
    const disagreement = calculateProjectDisagreement(pId, scoresList);

    await db.insert(projectCoverage).values({
      normalizationRunId: normRun.id,
      projectId: pId,
      actualReviews: pScore.reviewCount,
      targetReviews: 3,
      coverageRatio: coverage.coverageRatio,
      coverageStatus: coverage.coverageStatus,
      isHighDisagreement: disagreement.isHighDisagreement,
      scoreRange: disagreement.scoreRange,
    });
  }

  // Record Audit Event
  await db.insert(auditEvents).values({
    eventId,
    actorUserId: acceptance.organizer.userId,
    action: 'FIXTURE.IMPORTED',
    resourceType: 'FIXTURE',
    resourceId: data.event.id,
    metadata: {
      filename: options.fixturePath,
      sha256,
      projectsCount: data.projects.length,
      scoresCount: data.scores.length,
    },
  });

  // Mark Fixture Imported in fixture_imports
  await db
    .insert(fixtureImports)
    .values({
      filename: options.fixturePath,
      sha256,
    })
    .onConflictDoNothing();

  return {
    skipped: false,
    sha256,
    eventId,
    eventSourceId: data.event.id,
    counts: {
      tracks: data.tracks.length,
      judges: data.judges.length,
      teams: data.teams.length,
      projects: data.projects.length,
      reviews: data.scores.length,
    },
    acceptance,
  };
}
