/**
 * Google Ads にログインしてクッキー + プロフィールを保存する
 * 使い方: npm run login:ads
 *
 * 永続プロフィール (launchPersistentContext) を使うことで、Google の自動化検出を回避。
 * 一度ログインしたら、以降は scrape-ads.mjs が同じプロフィールでクッキー込みで開く。
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-ads');
const COOKIE_FILE = path.join(AUTH_DIR, 'google-ads.json');
const INFO_FILE = path.join(AUTH_DIR, 'googleAds-info.json');

const DASHBOARD_URL =
  'https://ads.google.com/aw/overview?ocid=644870590&euid=1506237073&__u=9128539977&uscid=644870590&__c=4605080910&authuser=0';
const CUSTOMER_ID = '989-421-6094';

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log('🌐 Google Ads ログイン用 Edge を起動します（永続プロフィール）...');
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  channel: 'msedge',
  viewport: { width: 1440, height: 900 },
  locale: 'ja-JP',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
});

// navigator.webdriver を無効化
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // chrome オブジェクトを偽装
  // @ts-ignore
  if (!window.chrome) window.chrome = { runtime: {} };
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ブラウザでログイン操作をしてください');
console.log('  (推奨アカウント: spot.sr.intern@gmail.com)');
console.log('  ダッシュボードが表示されたらこのターミナルに戻って Enter');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

await new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('準備できたら Enter: ', () => {
    rl.close();
    resolve();
  });
});

const cookies = await context.cookies();
const dashboardUrl = page.url();
let snippet = '';
try {
  snippet = (await page.locator('body').innerText({ timeout: 5000 })).slice(0, 4000);
} catch {
  /* ignore */
}

fs.writeFileSync(
  COOKIE_FILE,
  JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2)
);
fs.writeFileSync(
  INFO_FILE,
  JSON.stringify(
    {
      target: 'googleAds',
      timestamp: new Date().toISOString(),
      url: dashboardUrl,
      dashboardUrl,
      customerIds: [CUSTOMER_ID],
      dashboardSnippet: snippet,
    },
    null,
    2
  )
);

console.log(`✅ クッキー保存: ${COOKIE_FILE}`);
console.log(`✅ ダッシュボード情報保存: ${INFO_FILE}`);
console.log(`✅ プロフィール保存: ${PROFILE_DIR}`);
console.log(`   クッキー数: ${cookies.length}`);

await context.close();
process.exit(0);
