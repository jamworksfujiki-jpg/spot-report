import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _supabaseAdmin;
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_WINDOW_MINUTES = 15;
export const SESSION_TTL_HOURS = 8;

export async function signSessionToken(username: string) {
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getJwtSecret());
}

export async function isLockedOut(username: string): Promise<boolean> {
  const since = new Date(
    Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();
  const { count } = await getSupabaseAdmin()
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("username", username)
    .eq("success", false)
    .gte("created_at", since);
  return (count ?? 0) >= LOCKOUT_THRESHOLD;
}

export async function recordAttempt(
  username: string,
  ip: string | null,
  success: boolean
) {
  await getSupabaseAdmin()
    .from("auth_attempts")
    .insert({ username, ip, success });
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("auth_users")
    .select("password_hash, is_active")
    .eq("username", username)
    .maybeSingle();
  if (!data || !data.is_active) {
    await bcrypt.compare(password, "$2b$10$" + "x".repeat(53));
    return false;
  }
  return bcrypt.compare(password, data.password_hash);
}
