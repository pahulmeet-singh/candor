import "server-only";
import { compare, hash } from "bcryptjs";

/** bcrypt cost 12 is roughly a quarter of a second on current hardware: slow enough to hurt guessing, fast enough for a login. */
const COST = 12;

/**
 * Compared against when the email is unknown, so a login for a missing account
 * takes as long as one for a real account and cannot be used to list who is registered.
 * (A syntactically valid hash of a password nobody knows.)
 */
const UNKNOWN_USER_HASH = "$2b$12$OyKgZ/.5Oct7UVBSE4IMHvTu8cGPKPOve/VsDcjARabExtkeJ9jde";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

export async function verifyPassword(plain: string, storedHash: string | null | undefined): Promise<boolean> {
  const matches = await compare(plain, storedHash ?? UNKNOWN_USER_HASH);
  return Boolean(storedHash) && matches;
}
