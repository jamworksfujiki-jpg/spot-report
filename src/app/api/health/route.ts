// ヘルスチェック: ログイン認証パスが動作することを検証（実認証はしない）
// 失敗 = env 設定ミス or runtime コンテナ破損。GitHub Actions 等で日次監視可
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // ADMIN_USERNAME
  const username = process.env.ADMIN_USERNAME;
  checks.adminUsername = { ok: !!username && username.length > 0 };

  // ADMIN_PASSWORD_HASH_B64 → デコード → bcrypt 形式チェック
  let validBcrypt = false;
  const b64 = process.env.ADMIN_PASSWORD_HASH_B64;
  try {
    if (b64) {
      const decoded = Buffer.from(b64, "base64").toString("utf-8").trim();
      validBcrypt = /^\$2[aby]?\$\d{2}\$.{53}$/.test(decoded);
    }
  } catch {
    /* ignore */
  }
  checks.adminPasswordHash = { ok: validBcrypt };

  // JWT_SECRET → 署名できるか
  let canSign = false;
  try {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.length >= 32) {
      await new SignJWT({ sub: "healthcheck" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1m")
        .sign(new TextEncoder().encode(secret));
      canSign = true;
    }
  } catch (e) {
    checks.jwtSign = { ok: false, detail: String(e).slice(0, 60) };
  }
  checks.jwtSign = checks.jwtSign || { ok: canSign };

  // bcrypt.compare 動作確認（ダミーハッシュで実行可否のみチェック）
  let bcryptWorks = false;
  try {
    await bcrypt.compare("test", "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY");
    bcryptWorks = true;
  } catch (e) {
    checks.bcryptCompare = { ok: false, detail: String(e).slice(0, 60) };
  }
  checks.bcryptCompare = checks.bcryptCompare || { ok: bcryptWorks };

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok: allOk, checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
