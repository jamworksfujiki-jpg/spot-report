/**
 * 全部まとめて実行 + git add/commit/push でデプロイトリガー
 * 使い方: npm run scrape:all
 *
 * Windows タスクスケジューラから毎朝呼ばれる前提。
 */
import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { alertFailure, hardExit } from './lib/fail-loud.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '..');
const SCRAPED_DIR = path.join(REPO_DIR, 'src', 'lib', 'scraped-data');
const LOG_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function logFile() {
  // 【2026-09-25 修正】以前は toISOString()＝UTC で日付を切っていたため、
  // JST 早朝の実行が「前日」のログファイルに書かれ、調査のたびに1日ズレて読み違えた。
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return path.join(LOG_DIR, `scrape-${d}.log`);
}
function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(logFile(), line);
}

let pushFailed = null;
let deployFailed = null;
let gitFailed = null;

logLine('===== scrape-all start =====');

/**
 * 1ステップを実行する。
 *
 * 【2026-09-25 修正】以前は timeout を渡していなかったため、Playwright が
 * ログイン画面で待ち続けると1ステップだけで15分（タスクの ExecutionTimeLimit）を
 * 食い潰し、タスクスケジューラに 0x41306 (SCHED_S_TASK_TERMINATED) で
 * 強制終了されていた。終了コードを見る前にプロセスごと消えるので、
 * 末尾の失敗アラートにも到達せず、19日間「何も起きていない」状態になった。
 * ステップ単位で打ち切れば、必ず最後のアラート送信まで到達できる。
 */
function runScript(name, file, timeoutMs = 4 * 60 * 1000) {
  logLine(`--- ${name} ---`);
  const r = spawnSync('node', [path.join(__dirname, file)], {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });
  if (r.error?.code === 'ETIMEDOUT' || r.signal) {
    logLine(`⚠️  ${name} timed out after ${Math.round(timeoutMs / 1000)}s (signal=${r.signal})`);
    return false;
  }
  if (r.status !== 0) {
    logLine(`⚠️  ${name} failed with exit code ${r.status}`);
    return false;
  }
  logLine(`✓ ${name} OK`);
  return true;
}

// 【2026-09-25】Playwright 版 (scrape-ads.mjs) から API 版へ切り替え。
// 画面のログイン状態・DOM・ZIP展開に依存しなくなるため、壊れ方が激減する。
// 旧版は scrape-ads.mjs として残してあるので、API が使えない環境では戻せる。
const adsOk = runScript('Google Ads (API)', 'scrape-ads-api.mjs');
// CV Actions: API ベース（setup-ads-api.mjs 実行済）なら API、未設定なら Playwright
const apiTokensExists = fs.existsSync(
  path.resolve(__dirname, '../../.reporting-auth/google-ads-tokens.json')
);
const cvOk = apiTokensExists
  ? runScript('CV Actions (API)', 'scrape-cv-actions-api.mjs')
  : runScript('CV Actions (Playwright fallback)', 'scrape-cv-actions.mjs');
const igOk = runScript('Instagram', 'scrape-instagram.mjs');

// git に差分があれば commit + push
try {
  const status = execSync('git status --short src/lib/scraped-data/', {
    cwd: REPO_DIR,
    encoding: 'utf8',
  }).trim();
  if (!status) {
    logLine('差分なし、commit/push スキップ');
  } else {
    logLine(`差分検出:\n${status}`);
    execSync('git add src/lib/scraped-data/', { cwd: REPO_DIR, stdio: 'inherit' });
    // 【2026-09-25 修正】toISOString() は UTC なのに末尾に "JST" と書いていたため、
    // コミット履歴の時刻が9時間ずれたまま「JST」を名乗っていた。
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date());
    const msg = `chore(data): auto-scrape ${stamp} JST`;
    execSync(`git commit -m "${msg}"`, { cwd: REPO_DIR, stdio: 'inherit' });

    // 【2026-07-31 修正】旧実装は git push を同じ try に入れていたため、
    // push が失敗（認証プロンプト等）すると catch に飛んで
    // **Vercel デプロイごとスキップ**され、取得できた新しい数字が
    // 本番に反映されないまま終わっていた。
    // push は「バックアップ」、deploy は「本番反映」で目的が違う。
    // push の失敗で deploy を巻き添えにしない。
    try {
      execSync('git push', { cwd: REPO_DIR, stdio: 'inherit' });
      logLine('✓ git push 完了');
    } catch (pushErr) {
      pushFailed = pushErr.message;
      logLine(`⚠️  git push 失敗（デプロイは続行）: ${pushErr.message}`);
    }

    // GitHub→Vercel 自動デプロイが不発のことがあるため、CLI で明示デプロイ
    // 2026-06-10: 数日 silent fail していたため追加
    try {
      execSync('vercel deploy --prod --scope=e-gov-spotportal --yes', {
        cwd: REPO_DIR,
        stdio: 'inherit',
        timeout: 180_000,
      });
      logLine('✓ Vercel 明示デプロイ完了');
    } catch (deployErr) {
      deployFailed = deployErr.message;
      logLine(`⚠️  Vercel デプロイ失敗: ${deployErr.message}`);
    }
  }
} catch (e) {
  gitFailed = e.message;
  logLine(`⚠️  git 操作失敗: ${e.message}`);
}

// 【2026-07-31 追加】失敗が起きた日は必ず人に届ける。
// これまでは個別ステップが落ちてもログに ⚠️ が残るだけで、
// タスクスケジューラ経由の実行では誰の目にも触れなかった。
const failed = [
  !adsOk && 'Google広告',
  !cvOk && 'CVアクション',
  !igOk && 'Instagram',
  // 取得できたのに本番へ出ていない＝見えない事故なので、これも失敗として通知する
  deployFailed && 'Vercelデプロイ',
  gitFailed && 'git操作',
].filter(Boolean);

if (failed.length) {
  const logPath = logFile();
  const tail = (() => {
    try { return fs.readFileSync(logPath, 'utf8').split('\n').slice(-40).join('\n'); }
    catch { return '(ログ読み取り不可)'; }
  })();
  await alertFailure({
    subject: `[spot-report] 日次データ取得が失敗しました (${failed.join(' / ')})`,
    body:
      `spot-report の日次スクレイプで失敗が発生しました。\n\n` +
      `失敗したデータ: ${failed.join(' / ')}\n` +
      `成功したデータ: ${[adsOk && 'Google広告', cvOk && 'CVアクション', igOk && 'Instagram'].filter(Boolean).join(' / ') || 'なし'}\n\n` +
      `該当データはダッシュボード上で更新されていません（古い数字が「最新」と表示されることはありません）。\n\n` +
      (pushFailed ? `git push 失敗（バックアップのみ・本番反映には影響なし）:\n${pushFailed}\n\n` : '') +
      `--- ログ末尾 ---\n${tail}\n`,
  });
}

logLine(`===== scrape-all end (ads=${adsOk ? 'OK' : 'NG'}, cv=${cvOk ? 'OK' : 'NG'}, ig=${igOk ? 'OK' : 'NG'}) =====`);
// fetch(undici) の後始末を待ってから終了する。
// 直後に process.exit() すると Windows で libuv のアサーションに当たり、
// 終了コードが 3221226505 (0xC0000409) に化けて真の失敗理由が読めなくなる。
await hardExit(failed.length ? 1 : 0);
