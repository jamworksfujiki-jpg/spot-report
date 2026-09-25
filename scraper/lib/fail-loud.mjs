/**
 * 「サイレント失敗」を根絶するための共通ユーティリティ
 *
 * 背景（2026-07-31 の事故）:
 *   scrape-ads.mjs は取得に失敗しても前回値をそのまま書き戻し、
 *   scrapedAt だけ「今」に更新して exit 0 で「✅ 更新」と表示していた。
 *   結果、2026-07-12 以降ずっと同じ数字が「最新データ」として表示され続け、
 *   実際の広告費(¥57,017)の 2 倍以上(¥125,627)を上司向けレポートに出していた。
 *
 * 鉄則:
 *   1. 取得できなかったら「書かない・古い時刻を保つ・非ゼロ終了」
 *   2. 前回値へのフォールバックをするなら、必ず stale フラグを立てて可視化する
 *   3. 失敗は人に届く形で通知する（メール）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resend の API キーを環境変数 → 既知の .env.local の順で探す（値はログに出さない） */
function findResendKey() {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  const candidates = [
    path.resolve(__dirname, '../../../nendosantei-form/.env.local'),
    path.resolve(__dirname, '../../.env.local'),
  ];
  for (const f of candidates) {
    try {
      if (!fs.existsSync(f)) continue;
      const m = fs.readFileSync(f, 'utf8').match(/^\s*RESEND_API_KEY\s*=\s*(.+)\s*$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * 失敗を人に通知する。送れなくても throw しない（通知失敗で本体を殺さない）が、
 * 送れなかったことは必ず stdout に残す。
 */
export async function alertFailure({ subject, body }) {
  const key = findResendKey();
  if (!key) {
    console.error('🔕 アラート未送信: RESEND_API_KEY が見つかりません');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // spot-s.jp のDNS/ドメイン状態に依存しない送信元を使う（不達の連鎖を避ける）
        from: 'spot-report monitor <onboarding@resend.dev>',
        to: ['jamworksfujiki@gmail.com'],
        subject,
        text: body,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`🔕 アラート送信失敗: HTTP ${res.status} ${text.slice(0, 300)}`);
      return false;
    }
    // Resend は 200 でも本文に error を返すことがあるので検査する
    try {
      const j = JSON.parse(text);
      if (j.error) {
        console.error(`🔕 アラート送信失敗(body.error): ${JSON.stringify(j.error).slice(0, 300)}`);
        return false;
      }
    } catch { /* JSONでなければそのまま成功扱い */ }
    console.log('📧 失敗アラートを送信しました');
    return true;
  } catch (e) {
    console.error('🔕 アラート送信例外:', e.message);
    return false;
  }
}

/**
 * 取得結果を検証して、ダメなら「書かずに」異常終了する。
 * @param {object} opts
 * @param {string} opts.name        データ名（ログ・メール件名用）
 * @param {boolean} opts.ok         取得が成功したか
 * @param {string} opts.reason      失敗理由
 * @param {string} opts.outFile     出力先（既存の scrapedAt を出すためだけに使う）
 */
export async function failLoud({ name, reason, outFile }) {
  let lastGood = '(不明)';
  try {
    if (outFile && fs.existsSync(outFile)) {
      const j = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      lastGood = j.scrapedAt || '(scrapedAt なし)';
    }
  } catch { /* ignore */ }

  console.error(`\n❌ ${name}: 取得に失敗しました`);
  console.error(`   理由: ${reason}`);
  console.error(`   → ファイルは更新しません（古い数字を「最新」と偽らないため）`);
  console.error(`   → 前回の正常取得: ${lastGood}`);

  await alertFailure({
    subject: `[spot-report] ${name} の取得に失敗しました`,
    body:
      `spot-report のデータ取得が失敗しました。\n\n` +
      `対象: ${name}\n` +
      `理由: ${reason}\n` +
      `前回の正常取得: ${lastGood}\n\n` +
      `ダッシュボードの数字はこの時点で止まっています。\n` +
      `復旧手順:\n` +
      `  1. cd C:\\Users\\fujik\\vscode\\spot-report\\scraper\n` +
      `  2. npm run login:ads   (Google広告のログインが切れている場合)\n` +
      `  3. node scrape-ads.mjs で再実行し、上記理由が解消したか確認\n`,
  });

  await hardExit(3);
}

/**
 * fetch 直後の process.exit() を避けて終了する。
 *
 * 【2026-09-25 修正】Windows + Node の fetch(undici) は、キープアライブ接続の
 * 後始末が終わる前に process.exit() すると libuv のアサーションで異常終了する:
 *   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
 *   → 終了コード 0xC0000409 (= 3221226505)
 * 毎日ログに出ていた「exit code 3221226505」の正体はこれで、
 * 「取得に失敗した本当の理由」がこのクラッシュで塗りつぶされ、原因追跡を19日間妨げていた。
 * 接続が閉じ切るのを少し待ってから終了する。
 */
export async function hardExit(code) {
  process.exitCode = code;
  await new Promise((r) => setTimeout(r, 300));
  process.exit(code);
}

/**
 * 数値が「全部ゼロ」かを判定する（ゼロ埋めデータを正常扱いしないため）
 */
export function allZero(rows, fields) {
  if (!rows || !rows.length) return true;
  return rows.every((r) => fields.every((f) => !r[f]));
}
