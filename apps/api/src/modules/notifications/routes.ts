import { FastifyPluginAsync } from 'fastify';
import { getDb, notifications } from '@dogfood/database';
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { createNotification } from '../../services/notifications/index.js';

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // 1. List User's Notifications
  app.get('/', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const db = getDb();
    const query = request.query as { unreadOnly?: string; limit?: string; offset?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const conditions = [eq(notifications.userId, request.user.userId)];
    if (query.unreadOnly === 'true') {
      conditions.push(isNull(notifications.readAt));
    }

    const items = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions));

    return {
      items: items.map((n: any) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      total: Number(totalRow?.count || 0),
      limit,
      offset,
    };
  });

  // 2. Unread Count
  app.get('/unread-count', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const db = getDb();
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, request.user.userId),
          isNull(notifications.readAt)
        )
      );

    return { count: Number(row?.count || 0) };
  });

  // 3. Mark Notification as Read
  app.patch('/:id/read', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const { id } = request.params as { id: string };
    const db = getDb();

    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, request.user.userId)
        )
      )
      .returning();

    if (!updated) {
      return reply.status(404).send({
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' },
      });
    }

    return { success: true, notification: updated };
  });

  // 4. Mark All as Read
  app.post('/read-all', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const db = getDb();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, request.user.userId),
          isNull(notifications.readAt)
        )
      );

    return { success: true };
  });

  // 5. Test Notification (Dev / Testing)
  app.post('/test', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const body = (request.body as any) || {};
    const notif = await createNotification({
      userId: request.user.userId,
      type: body.type || 'SYSTEM',
      title: body.title || 'Test Notification',
      body: body.body || 'This is a test notification from DOGFOOD 2026.',
      emailNotify: body.emailNotify === true,
    });

    return { success: true, notification: notif };
  });
};
