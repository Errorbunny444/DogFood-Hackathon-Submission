import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { users, sessions, eventMemberships, organizations, organizationMemberships } from '@dogfood/database';
import { DETERMINISTIC_SESSIONS } from '@dogfood/shared';

export interface AcceptanceSeedResult {
  organizer: { email: string; cookie: string; userId: string };
  judgeA: { email: string; cookie: string; userId: string; sourceId: string };
  judgeB: { email: string; cookie: string; userId: string; sourceId: string };
  participant: { email: string; cookie: string; userId: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Seeds deterministic test sessions for DOGFOOD acceptance testing.
 */
export async function seedAcceptanceSessions(
  db: any,
  eventId: string
): Promise<AcceptanceSeedResult> {
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

  // 1. Organizer
  const orgEmail = 'organizer@dogfood.local';
  let [orgUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, orgEmail))
    .limit(1);

  if (!orgUser) {
    [orgUser] = await db
      .insert(users)
      .values({
        email: orgEmail,
        passwordHash: 'dummy_hash_for_test_identities',
        displayName: 'Platform Organizer',
        globalRole: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
  }

  // Ensure event membership for organizer
  const [existingOrgMembership] = await db
    .select()
    .from(eventMemberships)
    .where(eq(eventMemberships.userId, orgUser.id))
    .limit(1);

  if (!existingOrgMembership) {
    await db.insert(eventMemberships).values({
      eventId,
      userId: orgUser.id,
      role: 'ORGANIZER',
      status: 'ACTIVE',
    });
  }

  // Ensure organization membership for organizer
  const [demoOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'dogfood-demo'))
    .limit(1);

  if (demoOrg) {
    await db
      .insert(organizationMemberships)
      .values({
        organizationId: demoOrg.id,
        userId: orgUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
      })
      .onConflictDoNothing();
  }

  // Session for organizer
  const orgToken = DETERMINISTIC_SESSIONS.ORGANIZER;
  const orgHash = hashToken(orgToken);
  await db
    .insert(sessions)
    .values({
      userId: orgUser.id,
      tokenHash: orgHash,
      rawToken: orgToken,
      expiresAt,
    })
    .onConflictDoNothing();

  // 2. Judge A (jdg_01: Tomas Varga)
  const [judgeAUser] = await db
    .select()
    .from(users)
    .where(eq(users.sourceId, 'jdg_01'))
    .limit(1);

  if (!judgeAUser) {
    throw new Error('Judge A (source_id jdg_01) not found in database.');
  }

  const judgeAToken = DETERMINISTIC_SESSIONS.JUDGE_A;
  const judgeAHash = hashToken(judgeAToken);
  await db
    .insert(sessions)
    .values({
      userId: judgeAUser.id,
      tokenHash: judgeAHash,
      rawToken: judgeAToken,
      expiresAt,
    })
    .onConflictDoNothing();

  // 3. Judge B (jdg_02: Wei Lindqvist)
  const [judgeBUser] = await db
    .select()
    .from(users)
    .where(eq(users.sourceId, 'jdg_02'))
    .limit(1);

  if (!judgeBUser) {
    throw new Error('Judge B (source_id jdg_02) not found in database.');
  }

  const judgeBToken = DETERMINISTIC_SESSIONS.JUDGE_B;
  const judgeBHash = hashToken(judgeBToken);
  await db
    .insert(sessions)
    .values({
      userId: judgeBUser.id,
      tokenHash: judgeBHash,
      rawToken: judgeBToken,
      expiresAt,
    })
    .onConflictDoNothing();

  // 4. Participant (from tm_01 or dedicated participant)
  const partEmail = 'lucas.silva@example.org';
  let [partUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, partEmail))
    .limit(1);

  if (!partUser) {
    [partUser] = await db
      .insert(users)
      .values({
        email: partEmail,
        passwordHash: 'dummy_hash_for_test_identities',
        displayName: 'Lucas Silva',
        globalRole: 'USER',
        status: 'ACTIVE',
      })
      .returning();
  }

  // Ensure event membership for participant
  const [existingPartMembership] = await db
    .select()
    .from(eventMemberships)
    .where(eq(eventMemberships.userId, partUser.id))
    .limit(1);

  if (!existingPartMembership) {
    await db.insert(eventMemberships).values({
      eventId,
      userId: partUser.id,
      role: 'PARTICIPANT',
      status: 'ACTIVE',
    });
  }

  const partToken = DETERMINISTIC_SESSIONS.PARTICIPANT;
  const partHash = hashToken(partToken);
  await db
    .insert(sessions)
    .values({
      userId: partUser.id,
      tokenHash: partHash,
      rawToken: partToken,
      expiresAt,
    })
    .onConflictDoNothing();

  return {
    organizer: {
      email: orgEmail,
      cookie: `Cookie: session=${orgToken}`,
      userId: orgUser.id,
    },
    judgeA: {
      email: judgeAUser.email,
      cookie: `Cookie: session=${judgeAToken}`,
      userId: judgeAUser.id,
      sourceId: 'jdg_01',
    },
    judgeB: {
      email: judgeBUser.email,
      cookie: `Cookie: session=${judgeBToken}`,
      userId: judgeBUser.id,
      sourceId: 'jdg_02',
    },
    participant: {
      email: partEmail,
      cookie: `Cookie: session=${partToken}`,
      userId: partUser.id,
    },
  };
}
