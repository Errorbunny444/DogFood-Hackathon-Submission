import { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { getDb, userMfa, users, auditEvents } from '@dogfood/database';
import { eq } from 'drizzle-orm';
import {
  generateTotpSecret,
  verifyTotpToken,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
} from '../../lib/totp.js';

export const mfaRoutes: FastifyPluginAsync = async (app) => {
  // 1. MFA Status
  app.get('/status', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(userMfa)
      .where(eq(userMfa.userId, request.user.userId));

    const backupCodes = (record?.backupCodes as string[]) || [];

    return {
      enabled: record ? record.enabled : false,
      hasBackupCodes: backupCodes.length > 0,
      backupCodesRemaining: backupCodes.length,
      updatedAt: record?.updatedAt?.toISOString(),
    };
  });

  // 2. Setup MFA: Generate Secret & Backup Codes
  app.post('/setup', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const { secret, uri } = generateTotpSecret(request.user.email);
    const { plainCodes, hashedCodes } = generateBackupCodes(8);

    return {
      secret,
      uri,
      backupCodes: plainCodes,
      _hashedBackupCodes: hashedCodes,
    };
  });

  // 3. Enable MFA
  app.post('/enable', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const body = request.body as {
      code: string;
      secret: string;
      backupCodes: string[];
    };

    if (!body?.code || !body?.secret) {
      return reply.status(400).send({
        error: { code: 'INVALID_INPUT', message: 'Code and secret are required.' },
      });
    }

    const isValid = verifyTotpToken(body.secret, body.code);
    if (!isValid) {
      return reply.status(400).send({
        error: { code: 'INVALID_MFA_CODE', message: 'Invalid 6-digit TOTP code.' },
      });
    }

    const db = getDb();

    // Check if record exists
    const [existing] = await db
      .select()
      .from(userMfa)
      .where(eq(userMfa.userId, request.user.userId));

    const hashedCodes = (body.backupCodes || []).map((code) => {
      const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return clean.length === 64
        ? clean.toLowerCase()
        : crypto.createHash('sha256').update(clean).digest('hex');
    });

    if (existing) {
      await db
        .update(userMfa)
        .set({
          secret: body.secret,
          enabled: true,
          backupCodes: hashedCodes,
          updatedAt: new Date(),
        })
        .where(eq(userMfa.id, existing.id));
    } else {
      await db.insert(userMfa).values({
        userId: request.user.userId,
        secret: body.secret,
        enabled: true,
        backupCodes: hashedCodes,
      });
    }

    // Audit Event
    await db.insert(auditEvents).values({
      actorUserId: request.user.userId,
      action: 'USER_MFA_ENABLED',
      resourceType: 'user_mfa',
      resourceId: request.user.userId,
      requestId: request.requestId,
      metadata: { method: 'TOTP' },
    });

    return {
      success: true,
      message: 'Two-factor authentication successfully enabled.',
    };
  });

  // 4. Disable MFA
  app.post('/disable', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const body = (request.body as { code?: string }) || {};
    const db = getDb();

    const [record] = await db
      .select()
      .from(userMfa)
      .where(eq(userMfa.userId, request.user.userId));

    if (!record || !record.enabled) {
      return reply.status(400).send({
        error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled on this account.' },
      });
    }

    // If code supplied, verify it
    if (body.code) {
      const isValid = verifyTotpToken(record.secret, body.code);
      const isBackup = !isValid && verifyAndConsumeBackupCode(body.code, (record.backupCodes as string[]) || []).valid;

      if (!isValid && !isBackup) {
        return reply.status(400).send({
          error: { code: 'INVALID_MFA_CODE', message: 'Invalid TOTP code or backup code.' },
        });
      }
    }

    await db
      .update(userMfa)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(eq(userMfa.userId, request.user.userId));

    // Audit Event
    await db.insert(auditEvents).values({
      actorUserId: request.user.userId,
      action: 'USER_MFA_DISABLED',
      resourceType: 'user_mfa',
      resourceId: request.user.userId,
      requestId: request.requestId,
      metadata: {},
    });

    return {
      success: true,
      message: 'Two-factor authentication has been disabled.',
    };
  });

  // 5. Verify MFA Token during Login / Elevation
  app.post('/verify', async (request, reply) => {
    const body = request.body as {
      userId: string;
      code: string;
    };

    if (!body?.userId || !body?.code) {
      return reply.status(400).send({
        error: { code: 'INVALID_INPUT', message: 'userId and code are required.' },
      });
    }

    const db = getDb();
    const [record] = await db
      .select()
      .from(userMfa)
      .where(eq(userMfa.userId, body.userId));

    if (!record || !record.enabled) {
      return { valid: true, mfaRequired: false };
    }

    const isTotpValid = verifyTotpToken(record.secret, body.code);
    if (isTotpValid) {
      return { valid: true, usedBackupCode: false };
    }

    // Try backup code
    const backupResult = verifyAndConsumeBackupCode(body.code, (record.backupCodes as string[]) || []);
    if (backupResult.valid) {
      await db
        .update(userMfa)
        .set({
          backupCodes: backupResult.remainingCodes,
          updatedAt: new Date(),
        })
        .where(eq(userMfa.id, record.id));

      return {
        valid: true,
        usedBackupCode: true,
        remainingBackupCodes: backupResult.remainingCodes.length,
      };
    }

    return reply.status(400).send({
      error: { code: 'INVALID_MFA_CODE', message: 'Invalid 6-digit TOTP code or backup code.' },
    });
  });
};
