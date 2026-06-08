import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_WINDOW_MINUTES = 15;
export const SESSION_TTL_HOURS = 8;

type Attempt = { fail: number; firstFailAt: number };
const attempts = new Map<string, Attempt>();

export async function signSessionToken(username: string) {
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getJwtSecret());
}

export async function isLockedOut(username: string): Promise<boolean> {
  const a = attempts.get(username);
  if (!a) return false;
  const expired = Date.now() - a.firstFailAt > LOCKOUT_WINDOW_MINUTES * 60_000;
  if (expired) {
    attempts.delete(username);
    return false;
  }
  return a.fail >= LOCKOUT_THRESHOLD;
}

export async function recordAttempt(
  username: string,
  _ip: string | null,
  success: boolean
) {
  if (success) {
    attempts.delete(username);
    return;
  }
  const a = attempts.get(username);
  if (!a) {
    attempts.set(username, { fail: 1, firstFailAt: Date.now() });
  } else {
    a.fail++;
  }
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUser || !expectedHash) return false;
  if (username !== expectedUser) {
    await bcrypt.compare(password, "$2b$10$" + "x".repeat(53));
    return false;
  }
  return bcrypt.compare(password, expectedHash);
}
