export interface AssignableProject {
  id: string;
  trackId?: string;
  teamId?: string;
}

export interface AssignableJudge {
  userId: string;
  preferredTrackIds: string[];
  conflictedTeamIds: string[];
  conflictedProjectIds: string[];
  maxCapacity: number;
}

export interface ExistingAssignment {
  judgeUserId: string;
  projectId: string;
}

export interface AssignmentResult {
  judgeUserId: string;
  projectId: string;
  trackMatch: boolean;
}

export interface AutoAssignOptions {
  targetReviewsPerProject: number;
  maxCapacityPerJudge: number;
  respectTrackPreferences: boolean;
  preventConflicts: boolean;
}

/**
 * Deterministic greedy judge assignment algorithm with workload balancing,
 * track preference optimization, and conflict prevention.
 */
export function autoAssignJudges(
  projects: AssignableProject[],
  judges: AssignableJudge[],
  existingAssignments: ExistingAssignment[] = [],
  options: AutoAssignOptions = {
    targetReviewsPerProject: 3,
    maxCapacityPerJudge: 15,
    respectTrackPreferences: true,
    preventConflicts: true,
  }
): AssignmentResult[] {
  // Sort projects and judges deterministically
  const sortedProjects = [...projects].sort((a, b) => a.id.localeCompare(b.id));
  const sortedJudges = [...judges].sort((a, b) => a.userId.localeCompare(b.userId));

  // Current assignment mappings
  const projectAssignments = new Map<string, Set<string>>(); // projectId -> Set<judgeUserId>
  const judgeWorkload = new Map<string, number>(); // judgeUserId -> count

  for (const j of sortedJudges) {
    judgeWorkload.set(j.userId, 0);
  }

  for (const p of sortedProjects) {
    projectAssignments.set(p.id, new Set<string>());
  }

  for (const ea of existingAssignments) {
    const assignedJudges = projectAssignments.get(ea.projectId);
    if (assignedJudges) {
      assignedJudges.add(ea.judgeUserId);
    }
    const currentCount = judgeWorkload.get(ea.judgeUserId) || 0;
    judgeWorkload.set(ea.judgeUserId, currentCount + 1);
  }

  const newAssignments: AssignmentResult[] = [];

  // Multi-pass greedy assignment
  // In each round, focus on projects with fewest reviews until target is reached
  let progressMade = true;

  while (progressMade) {
    progressMade = false;

    // Sort projects by:
    // 1. Current review count ascending (under-reviewed projects first)
    // 2. Project ID for determinism
    sortedProjects.sort((a, b) => {
      const countA = projectAssignments.get(a.id)?.size || 0;
      const countB = projectAssignments.get(b.id)?.size || 0;
      return countA - countB || a.id.localeCompare(b.id);
    });

    for (const project of sortedProjects) {
      const currentAssigned = projectAssignments.get(project.id)!;
      if (currentAssigned.size >= options.targetReviewsPerProject) {
        continue; // Project already reached target
      }

      // Find best available judge
      const candidates: {
        judge: AssignableJudge;
        trackMatch: boolean;
        currentLoad: number;
      }[] = [];

      for (const judge of sortedJudges) {
        // 1. Check already assigned
        if (currentAssigned.has(judge.userId)) {
          continue;
        }

        // 2. Check hard capacity
        const currentLoad = judgeWorkload.get(judge.userId) || 0;
        const capacity = Math.min(judge.maxCapacity, options.maxCapacityPerJudge);
        if (currentLoad >= capacity) {
          continue;
        }

        // 3. Check conflicts
        if (options.preventConflicts) {
          if (judge.conflictedProjectIds.includes(project.id)) {
            continue;
          }
          if (project.teamId && judge.conflictedTeamIds.includes(project.teamId)) {
            continue;
          }
        }

        const trackMatch =
          options.respectTrackPreferences && project.trackId
            ? judge.preferredTrackIds.includes(project.trackId)
            : false;

        candidates.push({ judge, trackMatch, currentLoad });
      }

      if (candidates.length === 0) {
        continue; // No valid judge found for this project in this iteration
      }

      // Sort candidate judges:
      // 1. Track match preferred (true > false)
      // 2. Lower current workload preferred (workload balancing)
      // 3. Deterministic tie-breaker by judge userId
      candidates.sort((a, b) => {
        if (a.trackMatch !== b.trackMatch) {
          return a.trackMatch ? -1 : 1;
        }
        if (a.currentLoad !== b.currentLoad) {
          return a.currentLoad - b.currentLoad;
        }
        return a.judge.userId.localeCompare(b.judge.userId);
      });

      const selected = candidates[0];
      currentAssigned.add(selected.judge.userId);
      judgeWorkload.set(selected.judge.userId, selected.currentLoad + 1);

      newAssignments.push({
        judgeUserId: selected.judge.userId,
        projectId: project.id,
        trackMatch: selected.trackMatch,
      });

      progressMade = true;
    }
  }

  return newAssignments;
}
