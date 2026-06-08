/**
 * Instagram プロフィール統計を取得して
 * `src/lib/scraped-data/instagram.json` に書き出す
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-instagram');
const COOKIE_FILE = path.join(AUTH_DIR, 'ig-session.json');
const OUT_DIR = path.resolve(__dirname, '../src/lib/scraped-data');
const OUT_FILE = path.join(OUT_DIR, 'instagram.json');
const IG_USERNAME = 'spotsharoushikun';
const PROFILE_URL = `https://www.instagram.com/${IG_USERNAME}/`;

if (!fs.existsSync(PROFILE_DIR)) {
  console.error(`❌ プロフィールが存在しません: ${PROFILE_DIR}`);
  console.error('   先に `npm run login:ig` を実行してください');
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

console.log(`📱 Instagram scrape: @${IG_USERNAME}`);

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  channel: 'msedge',
  viewport: { width: 1280, height: 800 },
  locale: 'ja-JP',
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
  ignoreDefaultArgs: ['--enable-automation'],
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // @ts-ignore
  if (!window.chrome) window.chrome = { runtime: {} };
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

if (page.url().includes('/accounts/login')) {
  console.error('❌ ログイン状態が失われています。再度 `npm run login:ig` を実行してください');
  await context.close();
  process.exit(2);
}

async function readMetaCount(label) {
  const text = await page
    .locator('header section ul li')
    .filter({ hasText: label })
    .first()
    .innerText()
    .catch(() => '');
  const m = text.match(/([\d,.]+)\s*([KkMm]?)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  const mult = m[2].toUpperCase() === 'K' ? 1000 : m[2].toUpperCase() === 'M' ? 1000000 : 1;
  return Math.round(num * mult);
}

let posts = await readMetaCount('投稿');
let followers = await readMetaCount('フォロワー');
let following = await readMetaCount('フォロー中');

if (!posts || !followers) {
  const meta = await page.locator('meta[name="description"]').getAttribute('content').catch(() => '');
  const m = meta && meta.match(/([\d,.]+[KkMm]?)\s*(?:Followers|フォロワー)[\s\S]*?([\d,.]+[KkMm]?)\s*(?:Following|フォロー中)[\s\S]*?([\d,.]+[KkMm]?)\s*(?:Posts|投稿)/);
  if (m) {
    const parse = (s) => {
      const n = parseFloat(s.replace(/,/g, ''));
      const u = s.slice(-1).toUpperCase();
      return Math.round(n * (u === 'K' ? 1000 : u === 'M' ? 1000000 : 1));
    };
    if (!followers) followers = parse(m[1]);
    if (!following) following = parse(m[2]);
    if (!posts) posts = parse(m[3]);
  }
}

try {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
} catch { /* ignore */ }

await context.close();

const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {};

const result = {
  ...existing,
  username: IG_USERNAME,
  posts: posts ?? existing.posts ?? null,
  followers: followers ?? existing.followers ?? null,
  following: following ?? existing.following ?? null,
  source: 'playwright-profile',
  scrapedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`✅ instagram.json 更新: ${OUT_FILE}`);
console.log(`   posts: ${result.posts}, followers: ${result.followers}, following: ${result.following}`);
