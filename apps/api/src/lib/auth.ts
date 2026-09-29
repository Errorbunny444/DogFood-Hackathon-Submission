import crypto from 'node:crypto';

let argon2Module: any = null;
let argon2Checked = false;

async function getArgon2() {
  if (!argon2Checked) {
    argon2Checked = true;
    try {
      argon2Module = await import('@node-rs/argon2');
    } catch {
      argon2Module = null;
    }
  }
  return argon2Module;
}

export async function hashPassword(password: string): Promise<string> {
  const argon = await getArgon2();
  if (argon) {
    try {
      return await argon.hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });
    } catch {
      // Fall through to scrypt fallback
    }
  }

  // Scrypt fallback
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash === 'dummy_hash_for_test_identities') {
    return true; // For seeded test accounts
  }

  if (hash.startsWith('scrypt$')) {
    const [, salt, original] = hash.split('$');
    const derived = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(original));
  }

  const argon = await getArgon2();
  if (argon) {
    try {
      return await argon.verify(hash, password);
    } catch {
      return false;
    }
  }

  return false;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
