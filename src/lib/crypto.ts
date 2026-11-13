import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM envelope for secrets stored in the database. The key lives only in the server
 * environment (KEY_ENCRYPTION_SECRET, 32 random bytes, base64), so a database leak alone reveals nothing.
 * The user id is bound as AAD: a ciphertext copied onto another user's row will not decrypt.
 */
function secret(): Buffer {
  const raw = process.env.KEY_ENCRYPTION_SECRET;
  const buf = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (buf.length !== 32) throw new Error('KEY_ENCRYPTION_SECRET must be 32 bytes, base64 encoded');
  return buf;
}

export function encrypt(plain: string, userId: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secret(), iv);
  c.setAAD(Buffer.from(userId));
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function decrypt(blob: string, userId: string): string {
  if (!blob.startsWith('v1:')) throw new Error('Unknown ciphertext version');
  const raw = Buffer.from(blob.slice(3), 'base64');
  const d = createDecipheriv('aes-256-gcm', secret(), raw.subarray(0, 12));
  d.setAAD(Buffer.from(userId));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}
