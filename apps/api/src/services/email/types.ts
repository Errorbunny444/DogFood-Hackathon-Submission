export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}
