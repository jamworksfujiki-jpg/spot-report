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
  if (!process.env.JWT_SECRET) {
    throw new Error("[auth] JWT_SECRET is not set");
  }
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

// bcrypt ハッシュは "$" を含む。Vercel CLI に直接 --value で渡すと黙ってtruncateされる
// 既知バグがあるため、必ず base64 でラップして ADMIN_PASSWORD_HASH_B64 として保存すること。
// 詳細: ../../README.md の「ENV 設定の注意」参照
function decodeExpectedHash(): string | undefined {
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64;
  if (!b64) return undefined;
  const decoded = Buffer.from(b64, "base64").toString("utf-8").trim();
  // 形式チェック: 復号後が bcrypt 形式でなければ env 設定ミス
  if (!/^\$2[aby]?\$\d{2}\$.{53}$/.test(decoded)) {
    console.error(
      "[auth] ADMIN_PASSWORD_HASH_B64 をデコードした結果が bcrypt 形式ではありません。" +
        " base64 でラップして保存してください。"
    );
    return undefined;
  }
  return decoded;
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  try {
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedHash = decodeExpectedHash();
    if (!expectedUser || !expectedHash) {
      console.error("[auth] missing ADMIN_USERNAME or ADMIN_PASSWORD_HASH_B64");
      return false;
    }
    if (username !== expectedUser) {
      try {
        await bcrypt.compare(password, "$2b$10$" + "x".repeat(53));
      } catch {
        /* timing-safe dummy, ignore */
      }
      return false;
    }
    return await bcrypt.compare(password, expectedHash);
  } catch (e) {
    console.error("[auth] verifyCredentials error:", e);
    return false;
  }
}
