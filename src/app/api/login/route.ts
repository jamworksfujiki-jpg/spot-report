import { NextRequest, NextResponse } from "next/server";
import {
  isLockedOut,
  recordAttempt,
  signSessionToken,
  verifyCredentials,
  SESSION_TTL_HOURS,
  LOCKOUT_WINDOW_MINUTES,
} from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    return await handleLogin(req);
  } catch (e) {
    console.error("[login] unhandled error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。時間を置いて再度お試しください。" },
      { status: 500 }
    );
  }
}

async function handleLogin(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "リクエスト形式が正しくありません" },
      { status: 400 }
    );
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "IDとパスワードを入力してください" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  if (await isLockedOut(username)) {
    return NextResponse.json(
      {
        error: `ログイン失敗が続いたため、${LOCKOUT_WINDOW_MINUTES}分間ロックされました。時間を置いて再度お試しください。`,
      },
      { status: 429 }
    );
  }

  const ok = await verifyCredentials(username, password);
  await recordAttempt(username, ip, ok);

  if (!ok) {
    return NextResponse.json(
      { error: "IDまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const token = await signSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * SESSION_TTL_HOURS,
  });
  return res;
}
