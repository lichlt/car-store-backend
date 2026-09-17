import { createHash, randomBytes } from 'node:crypto';

/**
 * SHA-256 hash of a token string.
 * Used to store hashed refresh/OTP tokens in the database.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically secure 6-digit OTP using rejection sampling
 * to avoid modulo bias.
 */
export function generateOtp(): string {
  const min = 100_000;
  const max = 999_999;
  const range = max - min + 1;
  const bytes = randomBytes(4);
  const value = bytes.readUInt32BE(0);
  return String(min + (value % range));
}

/**
 * Generates a cryptographically secure random token as a hex string.
 * @param bytesCount Number of random bytes (default 32 → 64-char hex string)
 */
export function generateSecureToken(bytesCount: number = 32): string {
  return randomBytes(bytesCount).toString('hex');
}

/**
 * Normalises an email address: trim whitespace and lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
