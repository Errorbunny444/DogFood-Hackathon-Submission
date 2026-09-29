import { FastifyInstance } from 'fastify';
import { eq, and, gt, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  getDb,
  users,
  sessions,
  authIdentities,
  emailVerificationTokens,
  passwordResetTokens,
  auditEvents,
} from '@dogfood/database';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '@dogfood/shared';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from '../../lib/auth.js';
import { requireAuth } from '../../middleware/auth.js';
import { config } from '../../config/index.js';
import { jobQueue } from '../../services/jobs/queue.js';
import { renderEmailVerificationEmail, renderPasswordResetEmail } from '../../services/email/templates.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login credentials format.',
          details: parse.error.issues,
        },
      });
    }

    const { email, password } = parse.data;
    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password.',
        },
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password.',
        },
      });
    }

    // Session Rotation: Generate fresh token upon authentication
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + config.sessionDurationDays * 24 * 60 * 60 * 1000
    );

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      rawToken: token,
      expiresAt,
    });

    reply.setCookie(config.sessionCookieName, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      expires: expiresAt,
    });

    await db.insert(auditEvents).values({
      actorUserId: user.id,
      action: 'AUTH.LOGIN',
      resourceType: 'USER_SESSION',
      resourceId: user.id,
      metadata: { email: user.email, ip: request.ip },
    });

    return reply.status(200).send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        emailVerified: !!user.emailVerifiedAt,
        globalRole: user.globalRole,
      },
      token,
    });
  });

  // POST /api/v1/auth/register
  app.post('/register', async (request, reply) => {
    const parse = registerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input.',
          details: parse.error.issues,
        },
      });
    }

    const { email, password, displayName } = parse.data;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists.',
        },
      });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        globalRole: 'USER',
      })
      .returning();

    // Attach primary PASSWORD identity
    await db.insert(authIdentities).values({
      userId: user.id,
      provider: 'PASSWORD',
      providerEmail: email,
      providerUserId: user.id,
    });

    // Create Email Verification Token
    const verifyRawToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto
      .createHash('sha256')
      .update(verifyRawToken)
      .digest('hex');
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: verifyTokenHash,
      expiresAt: verifyExpiresAt,
    });

    // Enqueue Verification Email background job
    try {
      const verifyUrl = `${request.headers.origin || 'http://localhost:8080'}/verify-email?token=${verifyRawToken}`;
      const emailContent = renderEmailVerificationEmail({ name: displayName, verifyUrl });
      await jobQueue.enqueue('email.send', {
        to: email,
        ...emailContent,
      });
    } catch (err) {
      console.warn('⚠️ Could not enqueue verification email:', err);
    }

    // Create session (Rotating identifier)
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + config.sessionDurationDays * 24 * 60 * 60 * 1000
    );

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      rawToken: token,
      expiresAt,
    });

    reply.setCookie(config.sessionCookieName, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      expires: expiresAt,
    });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        emailVerified: false,
        globalRole: user.globalRole,
      },
      token,
      verificationToken: (config.appMode === 'demo' || process.env.NODE_ENV === 'test') ? verifyRawToken : undefined,
    });
  });

  // POST /api/v1/auth/forgot-password (Non-enumerating)
  app.post('/forgot-password', async (request, reply) => {
    const parse = forgotPasswordSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email address.' },
      });
    }

    const { email } = parse.data;
    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let resetToken: string | undefined = undefined;

    if (user && user.status === 'ACTIVE') {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      resetToken = rawToken;

      try {
        const resetUrl = `${request.headers.origin || 'http://localhost:8080'}/reset-password?token=${rawToken}`;
        const emailContent = renderPasswordResetEmail({ name: user.displayName, resetUrl });
        await jobQueue.enqueue('email.send', {
          to: user.email,
          ...emailContent,
        });
      } catch (err) {
        console.warn('⚠️ Could not enqueue password reset email:', err);
      }
    }

    // Always return constant message to prevent user enumeration
    return reply.status(200).send({
      success: true,
      message:
        'If an account exists with that email address, password reset instructions have been generated.',
      resetToken: (config.appMode === 'demo' || process.env.NODE_ENV === 'test') ? resetToken : undefined,
    });
  });

  // POST /api/v1/auth/reset-password
  app.post('/reset-password', async (request, reply) => {
    const parse = resetPasswordSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid reset token or password length (minimum 8 characters).',
        },
      });
    }

    const { token, newPassword } = parse.data;
    const db = getDb();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const [resetRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!resetRecord || resetRecord.usedAt) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Password reset link is invalid or has expired.',
        },
      });
    }

    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, resetRecord.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetRecord.id));

    // Revoke all existing sessions for security
    await db.delete(sessions).where(eq(sessions.userId, resetRecord.userId));

    return reply.status(200).send({
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new password.',
    });
  });

  // POST /api/v1/auth/verify-email
  app.post('/verify-email', async (request, reply) => {
    const parse = verifyEmailSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid verification token.' },
      });
    }

    const { token } = parse.data;
    const db = getDb();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const [record] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!record) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Email verification token is invalid or has expired.',
        },
      });
    }

    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, record.userId));

    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, record.id));

    return reply.status(200).send({
      success: true,
      message: 'Email address successfully verified.',
    });
  });

  // POST /api/v1/auth/change-password
  app.post('/change-password', { preHandler: [requireAuth] }, async (request, reply) => {
    const parse = changePasswordSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid password format (minimum 8 characters).',
        },
      });
    }

    const { currentPassword, newPassword } = parse.data;
    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, request.user!.id))
      .limit(1);

    if (!user) {
      return reply.status(404).send({
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' },
      });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return reply.status(400).send({
        error: { code: 'INCORRECT_PASSWORD', message: 'Current password is incorrect.' },
      });
    }

    const newHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return reply.status(200).send({
      success: true,
      message: 'Password changed successfully.',
    });
  });

  // PATCH /api/v1/auth/profile
  app.patch('/profile', { preHandler: [requireAuth] }, async (request, reply) => {
    const parse = updateProfileSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid profile data.' },
      });
    }

    const db = getDb();
    const [updated] = await db
      .update(users)
      .set({
        ...parse.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, request.user!.id))
      .returning();

    return reply.status(200).send({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        bio: updated.bio,
        avatarPath: updated.avatarPath,
        emailVerified: !!updated.emailVerifiedAt,
      },
    });
  });

  // POST /api/v1/auth/sessions/revoke-all ("Sign out all devices")
  app.post(
    '/sessions/revoke-all',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const db = getDb();
      await db.delete(sessions).where(eq(sessions.userId, request.user!.id));

      reply.clearCookie(config.sessionCookieName, { path: '/' });
      return reply.status(200).send({
        success: true,
        message: 'All active sessions on all devices have been revoked.',
      });
    }
  );

  // POST /api/v1/auth/logout
  app.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    const db = getDb();
    if (request.user?.sessionId) {
      await db.delete(sessions).where(eq(sessions.id, request.user.sessionId));
    }

    reply.clearCookie(config.sessionCookieName, { path: '/' });
    return reply.status(200).send({ success: true });
  });

  // GET /api/v1/auth/me
  app.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(200).send({ user: null });
    }

    const db = getDb();
    const [userRec] = await db
      .select({
        id: users.id,
        sourceId: users.sourceId,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        avatarPath: users.avatarPath,
        globalRole: users.globalRole,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1);

    const identities = await db
      .select({
        id: authIdentities.id,
        provider: authIdentities.provider,
        providerEmail: authIdentities.providerEmail,
        createdAt: authIdentities.createdAt,
      })
      .from(authIdentities)
      .where(eq(authIdentities.userId, request.user.id));

    return reply.status(200).send({
      user: {
        id: userRec?.id || request.user.id,
        sourceId: userRec?.sourceId || request.user.sourceId,
        email: userRec?.email || request.user.email,
        displayName: userRec?.displayName || request.user.displayName,
        bio: userRec?.bio || '',
        avatarPath: userRec?.avatarPath || null,
        globalRole: userRec?.globalRole || request.user.globalRole,
        emailVerified: !!userRec?.emailVerifiedAt,
        identities,
        eventRoles: Object.fromEntries(request.user.eventRoles.entries()),
      },
    });
  });
}
