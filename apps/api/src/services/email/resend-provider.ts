import { EmailDeliveryResult, EmailMessage, EmailProvider } from './types.js';

export interface ResendConfig {
  apiKey?: string;
  defaultFrom?: string;
}

export class ResendEmailProvider implements EmailProvider {
  public readonly name = 'resend';
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(config?: ResendConfig) {
    this.apiKey = config?.apiKey || process.env.RESEND_API_KEY || '';
    this.defaultFrom = config?.defaultFrom || process.env.EMAIL_FROM || 'onboarding@resend.dev';
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.apiKey) {
      console.warn('⚠️ [ResendEmailProvider] Missing RESEND_API_KEY. Simulating delivery.');
      return {
        success: true,
        messageId: `mock-resend-${Date.now()}`,
        provider: 'resend',
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from || this.defaultFrom,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        throw new Error(data?.message || `HTTP ${response.status} from Resend API`);
      }

      return {
        success: true,
        messageId: data.id,
        provider: 'resend',
      };
    } catch (err: any) {
      console.error('❌ [ResendEmailProvider] Error sending email:', err.message);
      return {
        success: false,
        error: err.message,
        provider: 'resend',
      };
    }
  }
}
