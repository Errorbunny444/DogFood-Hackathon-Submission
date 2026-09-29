import crypto from 'node:crypto';

export interface GeneratedApiKey {
  token: string;
  prefix: string;
  tokenHash: string;
}

/**
 * Generates an industrial-strength API key with prefix.
 * Format: dfk_<prefix>_<randomSecret>
 * Example: dfk_live_4a8b7c9d0e1f...
 */
export function generateApiKey(prefixTag: string = 'live'): GeneratedApiKey {
  const prefix = `dfk_${prefixTag}_${crypto.randomBytes(4).toString('hex')}`;
  const secret = crypto.randomBytes(24).toString('hex');
  const token = `${prefix}_${secret}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  return {
    token,
    prefix,
    tokenHash,
  };
}

export function hashApiKey(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
