import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(accountName: string, issuer: string = 'DOGFOOD 2026') {
  const secretBuffer = crypto.randomBytes(20);
  const secret = base32Encode(secretBuffer);
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const uri = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

  return { secret, uri };
}

export function computeTotp(secret: string, timeStep: number): string {
  const key = base32Decode(secret);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226)
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const code = (codeInt % 1_000_000).toString().padStart(6, '0');
  return code;
}

export function verifyTotpToken(secret: string, token: string, window: number = 1): boolean {
  if (!token || typeof token !== 'string') return false;
  const sanitizedToken = token.trim().replace(/\s+/g, '');
  if (sanitizedToken.length !== 6 || !/^\d{6}$/.test(sanitizedToken)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let i = -window; i <= window; i++) {
    const expected = computeTotp(secret, currentStep + i);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sanitizedToken))) {
      return true;
    }
  }

  return false;
}

export function generateBackupCodes(count: number = 8) {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 characters, e.g. 3F8B2C9A
    plainCodes.push(code);
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    hashedCodes.push(hash);
  }

  return { plainCodes, hashedCodes };
}

export function verifyAndConsumeBackupCode(
  inputCode: string,
  hashedCodes: string[]
): { valid: boolean; remainingCodes: string[] } {
  if (!inputCode || !Array.isArray(hashedCodes)) {
    return { valid: false, remainingCodes: hashedCodes || [] };
  }

  const clean = inputCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inputHash = crypto.createHash('sha256').update(clean).digest('hex');

  const idx = hashedCodes.findIndex((h) => h === inputHash);
  if (idx !== -1) {
    const remainingCodes = [...hashedCodes];
    remainingCodes.splice(idx, 1);
    return { valid: true, remainingCodes };
  }

  return { valid: false, remainingCodes: hashedCodes };
}
