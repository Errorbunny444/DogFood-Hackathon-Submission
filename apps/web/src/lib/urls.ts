export function isValidExternalUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isExampleDomain(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('example.org') || lower.includes('example.com');
}

export function getProjectRepositoryLink(project: {
  id: string;
  sourceType?: string;
  repositoryUrl?: string | null;
}): { href: string; isInternal: boolean } {
  if (!project.repositoryUrl || !isValidExternalUrl(project.repositoryUrl)) {
    return { href: `/demo/projects/${project.id}/repository`, isInternal: true };
  }

  if (project.sourceType === 'FIXTURE' || isExampleDomain(project.repositoryUrl)) {
    return { href: `/demo/projects/${project.id}/repository`, isInternal: true };
  }

  return { href: project.repositoryUrl, isInternal: false };
}

export function getProjectDemoLink(project: {
  id: string;
  sourceType?: string;
  demoUrl?: string | null;
}): { href: string; isInternal: boolean } {
  if (!project.demoUrl || !isValidExternalUrl(project.demoUrl)) {
    return { href: `/demo/projects/${project.id}/live-demo`, isInternal: true };
  }

  if (project.sourceType === 'FIXTURE' || isExampleDomain(project.demoUrl)) {
    return { href: `/demo/projects/${project.id}/live-demo`, isInternal: true };
  }

  return { href: project.demoUrl, isInternal: false };
}
