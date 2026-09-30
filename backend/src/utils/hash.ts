import { createHash } from 'crypto';

// Refresh tokens are only ever stored as a SHA-256 digest — a leaked DB
// row can't be replayed as a bearer token this way.
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
