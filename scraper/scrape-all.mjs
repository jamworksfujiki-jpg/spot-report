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
    execSync('git push', { cwd: REPO_DIR, stdio: 'inherit' });
    logLine('✓ git push 完了、Vercel が自動デプロイします');
  }
} catch (e) {
  logLine(`⚠️  git 操作失敗: ${e.message}`);
}

logLine(`===== scrape-all end (ads=${adsOk ? 'OK' : 'NG'}, cv=${cvOk ? 'OK' : 'NG'}, ig=${igOk ? 'OK' : 'NG'}) =====`);
process.exit(adsOk && cvOk && igOk ? 0 : 1);
