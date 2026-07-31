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
import { alertFailure } from './lib/fail-loud.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '..');
const SCRAPED_DIR = path.join(REPO_DIR, 'src', 'lib', 'scraped-data');
const LOG_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function logFile() {
  const d = new Date();
  return path.join(LOG_DIR, `scrape-${d.toISOString().slice(0, 10)}.log`);
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

function runScript(name, file) {
  logLine(`--- ${name} ---`);
  const r = spawnSync('node', [path.join(__dirname, file)], {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    logLine(`⚠️  ${name} failed with exit code ${r.status}`);
    return false;
  }
  logLine(`✓ ${name} OK`);
  return true;
}

const adsOk = runScript('Google Ads', 'scrape-ads.mjs');
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
    const msg = `chore(data): auto-scrape ${new Date().toISOString().slice(0, 16).replace('T', ' ')} JST`;
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
process.exit(failed.length ? 1 : 0);
