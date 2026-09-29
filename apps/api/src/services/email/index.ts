import { EmailProvider } from './types.js';
import { ConsoleEmailProvider } from './console-provider.js';
import { SmtpEmailProvider } from './smtp-provider.js';
import { ResendEmailProvider } from './resend-provider.js';

export * from './types.js';
export * from './console-provider.js';
export * from './smtp-provider.js';
export * from './resend-provider.js';
export * from './templates.js';

let defaultEmailProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!defaultEmailProvider) {
    const providerType = (process.env.EMAIL_PROVIDER || 'console').toLowerCase().trim();
    if (providerType === 'resend') {
      defaultEmailProvider = new ResendEmailProvider();
    } else if (providerType === 'smtp') {
      defaultEmailProvider = new SmtpEmailProvider();
    } else {
      defaultEmailProvider = new ConsoleEmailProvider();
    }
  }
  return defaultEmailProvider;
}

export function setEmailProvider(provider: EmailProvider): void {
  defaultEmailProvider = provider;
}
