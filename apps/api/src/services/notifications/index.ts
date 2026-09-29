import { getDb, notifications, users } from '@dogfood/database';
import { eq } from 'drizzle-orm';
import { jobQueue } from '../jobs/queue.js';
import { NotificationItem } from '@dogfood/shared';

export interface CreateNotificationParams {
  userId: string;
  type: 'TEAM_INVITE' | 'JUDGE_ASSIGNED' | 'SUBMISSION_CONFIRMATION' | 'RESULTS_PUBLISHED' | 'DEADLINE_WARNING' | 'SYSTEM';
  title: string;
  body: string;
  emailNotify?: boolean;
  emailSubject?: string;
  emailHtml?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<NotificationItem> {
  const db = getDb();

  const [created] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
    })
    .returning();

  // If email notify requested, look up user email and enqueue background job
  if (params.emailNotify) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, params.userId));

    if (user && user.email) {
      await jobQueue.enqueue('email.send', {
        to: user.email,
        subject: params.emailSubject || params.title,
        text: params.body,
        html: params.emailHtml,
      });
    }
  }

  return {
    id: created.id,
    userId: created.userId,
    type: created.type as any,
    title: created.title,
    body: created.body,
    readAt: created.readAt ? created.readAt.toISOString() : null,
    createdAt: created.createdAt.toISOString(),
  };
}
