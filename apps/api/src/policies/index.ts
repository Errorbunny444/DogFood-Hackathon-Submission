import { AuthenticatedUser } from '../middleware/auth.js';

export interface AuthorizeOptions {
  actor?: AuthenticatedUser;
  action: string;
  resource?: {
    type?: string;
    orgId?: string;
    orgSlug?: string;
    eventId?: string;
    targetJudgeId?: string;
    targetJudgeSourceId?: string;
    teamId?: string;
    userId?: string;
  };
}

export function authorize({ actor, action, resource }: AuthorizeOptions): boolean {
  if (!actor) {
    return false;
  }

  // Global admin can perform any action
  if (actor.globalRole === 'ADMIN') {
    return true;
  }

  // Organization-level role
  const orgRole =
    (resource?.orgId ? actor.orgRoles.get(resource.orgId) : undefined) ||
    (resource?.orgSlug ? actor.orgSlugRoles.get(resource.orgSlug) : undefined);

  // Event-level role
  const eventRole = resource?.eventId ? actor.eventRoles.get(resource.eventId) : undefined;

  switch (action) {
    // Organization actions
    case 'ORG.MANAGE':
    case 'ORG.MEMBER_MANAGE':
    case 'ORG.EVENT_CREATE':
      return orgRole === 'OWNER' || orgRole === 'ADMIN';

    case 'ORG.DELETE':
      return orgRole === 'OWNER';

    case 'ORG.VIEW_MEMBERS':
      return orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'MEMBER';

    // Event actions
    case 'EVENT.MANAGE':
    case 'EVENT.EXPORT':
    case 'JUDGING.AUTO_ASSIGN':
    case 'NORMALIZATION.RUN':
    case 'RESULTS.PUBLISH':
    case 'AUDIT.VIEW':
      // Either an event-level ORGANIZER or an org-level OWNER/ADMIN
      return eventRole === 'ORGANIZER' || orgRole === 'OWNER' || orgRole === 'ADMIN';

    case 'JUDGE.VIEW_SCORES': {
      // Organizer of the event or org owner/admin can view all judge scores
      if (eventRole === 'ORGANIZER' || orgRole === 'OWNER' || orgRole === 'ADMIN') {
        return true;
      }
      // Judge can ONLY view their own scores
      if (
        (resource?.targetJudgeId && actor.id === resource.targetJudgeId) ||
        (resource?.targetJudgeSourceId && actor.sourceId === resource.targetJudgeSourceId)
      ) {
        return true;
      }
      return false;
    }

    case 'REVIEW.EDIT':
    case 'REVIEW.SUBMIT': {
      // Must be a judge and must be the author
      if (resource?.targetJudgeId && actor.id !== resource.targetJudgeId) {
        return false;
      }
      return eventRole === 'JUDGE';
    }

    case 'PROJECT.SUBMIT':
    case 'PROJECT.EDIT': {
      // Organizer, org admin, or participant
      if (eventRole === 'ORGANIZER' || orgRole === 'OWNER' || orgRole === 'ADMIN') {
        return true;
      }
      return eventRole === 'PARTICIPANT';
    }

    default:
      return false;
  }
}
