export interface ProjectCandidate {
  id: string;
  sourceId?: string;
  teamId?: string | null;
  teamSourceId?: string;
  title: string;
  repositoryUrl?: string | null;
  summary?: string | null;
  submittedAt?: string | null;
}

export interface DuplicateDetectionResult {
  projectId: string;
  duplicateOfId: string;
  reasons: string[];
}

export function detectDuplicates(
  projects: ProjectCandidate[]
): DuplicateDetectionResult[] {
  const duplicates: DuplicateDetectionResult[] = [];

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];

      const reasons: string[] = [];

      // Check team match
      const sameTeam =
        (a.teamId && b.teamId && a.teamId === b.teamId) ||
        (a.teamSourceId && b.teamSourceId && a.teamSourceId === b.teamSourceId);
      if (sameTeam) {
        reasons.push('SAME_TEAM');
      }

      // Check repository match
      const sameRepo =
        a.repositoryUrl &&
        b.repositoryUrl &&
        a.repositoryUrl.trim().toLowerCase() === b.repositoryUrl.trim().toLowerCase();
      if (sameRepo) {
        reasons.push('SAME_REPOSITORY');
      }

      // Check title match
      const normTitleA = a.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitleB = b.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const sameTitle = normTitleA === normTitleB && normTitleA.length > 0;
      if (sameTitle) {
        reasons.push('SAME_TITLE');
      }

      // If at least 2 strong signals match, or same repo + same team:
      if (reasons.length >= 2 || (sameTeam && sameTitle) || (sameTeam && sameRepo)) {
        // Earlier submission is the original, later submission is duplicateOf
        const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;

        const original = dateA <= dateB ? a : b;
        const dup = dateA <= dateB ? b : a;

        duplicates.push({
          projectId: dup.id,
          duplicateOfId: original.id,
          reasons,
        });
      }
    }
  }

  return duplicates;
}
