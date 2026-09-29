import crypto from 'node:crypto';
import { EmailDeliveryResult, EmailMessage, EmailProvider } from './types.js';

export interface RecordedEmail extends EmailMessage {
  id: string;
  sentAt: Date;
}

export class ConsoleEmailProvider implements EmailProvider {
  public readonly name = 'console';
  private sentEmails: RecordedEmail[] = [];

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const id = crypto.randomUUID();
    const recorded: RecordedEmail = {
      ...message,
      id,
      sentAt: new Date(),
    };
    this.sentEmails.push(recorded);

    const recipients = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const from = message.from || process.env.EMAIL_FROM || 'noreply@dogfood.local';

    // Pretty-printed console box for development and offline self-hosting
    console.log('\n==================== [OUTGOING EMAIL (CONSOLE)] ====================');
    console.log(`✉️  Message ID : ${id}`);
    console.log(`📤 From       : ${from}`);
    console.log(`📥 To         : ${recipients}`);
    console.log(`📋 Subject    : ${message.subject}`);
    if (message.text) {
      console.log(`📝 Text Body  :\n${message.text.trim()}`);
    } else {
      // Strip simple HTML tags for quick preview
      const preview = message.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      console.log(`📝 Preview    : ${preview}...`);
    }
    console.log('===================================================================\n');

    return {
      success: true,
      messageId: id,
      provider: 'console',
    };
  }

  getSentEmails(): RecordedEmail[] {
    return [...this.sentEmails];
  }

  getLastEmail(): RecordedEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }
}
