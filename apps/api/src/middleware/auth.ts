import { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gt, or } from 'drizzle-orm';
import {
  getDb,
  users,
  sessions,
  eventMemberships,
  organizations,
  organizationMemberships,
  apiKeys,
} from '@dogfood/database';
import { hashSessionToken } from '../lib/auth.js';
import { hashApiKey } from '../lib/api-keys.js';
import { config } from '../config/index.js';

export interface AuthenticatedUser {
  id: string;
  userId: string;
  sourceId: string | null;
  email: string;
  displayName: string;
  globalRole: string;
  sessionId: string;
  eventRoles: Map<string, string>; // eventId -> role (PARTICIPANT, JUDGE, ORGANIZER)
  orgRoles: Map<string, string>; // orgId -> role (OWNER, ADMIN, MEMBER)
  orgSlugRoles: Map<string, string>; // orgSlug -> role (OWNER, ADMIN, MEMBER)
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    requestId?: string;
  }
}

export function extractSessionToken(request: FastifyRequest): string | null {
  // 1. From Fastify cookie plugin
  const cookieSession = request.cookies?.session;
  if (cookieSession) {
    return cookieSession;
  }

  // 2. From raw Cookie header (e.g. Cookie: session=...)
  const rawCookieHeader = request.headers.cookie;
  if (rawCookieHeader) {
    const match = rawCookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // 3. From Authorization: Bearer <token>
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractSessionToken(request);
  const apiKeyHeader = (request.headers['x-api-key'] as string) || (token?.startsWith('dfk_') ? token : null);
  const db = getDb();
  const now = new Date();

  // 1. Scoped API Key Authentication (Section 25)
  if (apiKeyHeader) {
    const keyHash = hashApiKey(apiKeyHeader);
    const [apiKeyRecord] = await db
      .select({
        id: apiKeys.id,
        organizationId: apiKeys.organizationId,
        scopes: apiKeys.scopes,
        name: apiKeys.name,
        expiresAt: apiKeys.expiresAt,
        orgSlug: organizations.slug,
      })
      .from(apiKeys)
      .innerJoin(organizations, eq(apiKeys.organizationId, organizations.id))
      .where(eq(apiKeys.tokenHash, keyHash))
      .limit(1);

    if (apiKeyRecord && (!apiKeyRecord.expiresAt || apiKeyRecord.expiresAt > now)) {
      db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKeyRecord.id)).catch(() => {});

      const orgRoles = new Map<string, string>([[apiKeyRecord.organizationId, 'ADMIN']]);
      const orgSlugRoles = new Map<string, string>([[apiKeyRecord.orgSlug, 'ADMIN']]);

      request.user = {
        id: `apikey_${apiKeyRecord.id}`,
        userId: `apikey_${apiKeyRecord.id}`,
        sourceId: null,
        email: `apikey@${apiKeyRecord.orgSlug}.local`,
        displayName: `API Key: ${apiKeyRecord.name}`,
        globalRole: 'API_CLIENT',
        sessionId: apiKeyRecord.id,
        eventRoles: new Map(),
        orgRoles,
        orgSlugRoles,
      };
      return;
    }
  }

  if (!token) {
    return; // Remains unauthenticated
  }

  const tokenHash = hashSessionToken(token);

  // Find session: In demo mode, permit deterministic rawToken matching for acceptance checks.
  // In production/cloud/selfhosted mode, only permit valid cryptographically hashed tokens.
  const tokenCondition =
    config.appMode === 'demo'
      ? or(eq(sessions.tokenHash, tokenHash), eq(sessions.rawToken, token))
      : eq(sessions.tokenHash, tokenHash);

  const [sessionRecord] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      id: users.id,
      sourceId: users.sourceId,
      email: users.email,
      displayName: users.displayName,
      globalRole: users.globalRole,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        tokenCondition,
        gt(sessions.expiresAt, now),
        eq(users.status, 'ACTIVE')
      )
    )
    .limit(1);

  if (!sessionRecord) {
    return;
  }

  // Fetch event memberships
  const memberships = await db
    .select({
      eventId: eventMemberships.eventId,
      role: eventMemberships.role,
    })
    .from(eventMemberships)
    .where(
      and(
        eq(eventMemberships.userId, sessionRecord.id),
        eq(eventMemberships.status, 'ACTIVE')
      )
    );

  const eventRoles = new Map<string, string>();
  for (const m of memberships) {
    eventRoles.set(m.eventId, m.role);
  }

  // Fetch organization memberships
  const orgMembers = await db
    .select({
      orgId: organizationMemberships.organizationId,
      orgSlug: organizations.slug,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMemberships.userId, sessionRecord.id),
        eq(organizationMemberships.status, 'ACTIVE')
      )
    );

  const orgRoles = new Map<string, string>();
  const orgSlugRoles = new Map<string, string>();
  for (const om of orgMembers) {
    orgRoles.set(om.orgId, om.role);
    orgSlugRoles.set(om.orgSlug, om.role);
  }

  request.user = {
    id: sessionRecord.id,
    userId: sessionRecord.id,
    sourceId: sessionRecord.sourceId,
    email: sessionRecord.email,
    displayName: sessionRecord.displayName,
    globalRole: sessionRecord.globalRole,
    sessionId: sessionRecord.sessionId,
    eventRoles,
    orgRoles,
    orgSlugRoles,
  };
}

export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
): void {
  if (!request.user) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access this resource.',
        requestId: request.requestId,
      },
    });
    return;
  }
  done();
}
