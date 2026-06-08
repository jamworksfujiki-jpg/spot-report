/**
 * Instagram にログインしてクッキー + プロフィールを保存する
 * 使い方: npm run login:ig
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-instagram');
const COOKIE_FILE = path.join(AUTH_DIR, 'ig-session.json');
const IG_USERNAME = 'spotsharoushikun';
const LOGIN_URL = 'https://www.instagram.com/accounts/login/';
const PROFILE_URL = `https://www.instagram.com/${IG_USERNAME}/`;

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log('🌐 Instagram ログイン用 Edge を起動します（永続プロフィール）...');
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  channel: 'msedge',
  viewport: { width: 1280, height: 800 },
  locale: 'ja-JP',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // @ts-ignore
  if (!window.chrome) window.chrome = { runtime: {} };
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ブラウザでログイン操作をしてください');
console.log(`  推奨アカウント: @${IG_USERNAME}`);
console.log('  ホーム画面が表示されたらこのターミナルに戻って Enter');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

await new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('準備できたら Enter: ', () => {
    rl.close();
    resolve();
  });
});

// プロフィールページでログイン状態を最終確認
try {
  await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
} catch {
  /* ignore */
}

const cookies = await context.cookies();
fs.writeFileSync(
  COOKIE_FILE,
  JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2)
);

console.log(`✅ クッキー保存: ${COOKIE_FILE}`);
console.log(`✅ プロフィール保存: ${PROFILE_DIR}`);
console.log(`   クッキー数: ${cookies.length}`);

await context.close();
process.exit(0);
