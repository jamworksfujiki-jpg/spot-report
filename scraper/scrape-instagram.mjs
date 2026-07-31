/**
 * Instagram プロフィール統計を取得して
 * `src/lib/scraped-data/instagram.json` に書き出す
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { failLoud } from './lib/fail-loud.mjs';

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

// 【2026-07-31 全面改修】
// 旧実装は (1) 'header section ul li' で数値を拾い、(2) 失敗時は meta description を
// 「411 フォロワー」の語順（数値→ラベル）で正規表現していた。
// しかし日本語UIの実際の表記は「フォロワー411人」（ラベル→数値）であり、
// DOM構造も変わっていたため両方とも失敗。にもかかわらず旧コードは前回値へ
// フォールバックしていたので、2026-07-14以降ずっと 408人 のまま固まっていた
// （実際は411人）。ラベル→数値・数値→ラベルの両方の語順に対応させる。
function parseCount(raw) {
  if (!raw) return null;
  const t = String(raw).replace(/,/g, '').trim();
  // 「1.2万」表記
  const man = t.match(/^([\d.]+)\s*万/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);
  const m = t.match(/^([\d.]+)\s*([KkMm]?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = m[2].toUpperCase();
  return Math.round(n * (u === 'K' ? 1000 : u === 'M' ? 1000000 : 1));
}

/** テキスト全体から「ラベル→数値」「数値→ラベル」双方の語順で数を拾う */
function extractFrom(text, jpLabel, jpUnit, enLabel) {
  if (!text) return null;
  const NUM = '([0-9.,]+\\s*万?[KkMm]?)';
  // 例: フォロワー411人 / 投稿38件（ラベル→数値。日本語UIの実際の表記）
  const a = text.match(new RegExp(jpLabel + '\\s*' + NUM + '\\s*' + jpUnit));
  if (a) return parseCount(a[1]);
  // 例: 411人のフォロワー / 411 フォロワー（数値→ラベル）
  const b = text.match(new RegExp(NUM + '\\s*' + jpUnit + '?\\s*(?:の)?' + jpLabel));
  if (b) return parseCount(b[1]);
  // 例: 411 followers（英語UI）
  if (enLabel) {
    const c = text.match(new RegExp('([0-9.,]+\\s*[KkMm]?)\\s*' + enLabel, 'i'));
    if (c) return parseCount(c[1]);
  }
  return null;
}

const metaDesc = await page
  .locator('meta[name="description"]')
  .getAttribute('content')
  .catch(() => '');
const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');

// meta description が最も安定（「フォロワー411人、フォロー中429人、投稿38件 - ...」）
let followers = extractFrom(metaDesc, 'フォロワー', '人', 'followers');
let following = extractFrom(metaDesc, 'フォロー中', '人', 'following');
let posts = extractFrom(metaDesc, '投稿', '件', 'posts');

// 取れなければ本文テキストから
if (followers === null) followers = extractFrom(bodyText, 'フォロワー', '人', 'followers');
if (following === null) following = extractFrom(bodyText, 'フォロー中', '人', 'following');
if (posts === null) posts = extractFrom(bodyText, '投稿', '件', 'posts');

console.log(`  抽出: フォロワー=${followers} / フォロー中=${following} / 投稿=${posts}`);

try {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
} catch { /* ignore */ }

await context.close();

// 【2026-07-31 修正】旧実装は followers 等が取れなくても existing の値を書き戻し、
// scrapedAt だけ「今」に更新して成功終了していた（サイレント失敗）。
// フォロワー数が取れていない = 取得失敗。前回値で塗り固めず、書かずに落とす。
if (followers === null || followers === undefined) {
  await failLoud({
    name: 'Instagram',
    reason: 'プロフィールからフォロワー数を取得できませんでした（ログイン切れ、またはInstagramのUI変更の可能性）',
    outFile: OUT_FILE,
  });
}

const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {};

const result = {
  ...existing,
  username: IG_USERNAME,
  posts: posts ?? null,
  // UI が参照するのは postsCount。旧実装はこれを更新しておらず
  // ...existing の値（38）が永久に残っていた
  postsCount: posts ?? null,
  followers,
  following: following ?? null,
  source: 'playwright-profile',
  scrapedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`✅ instagram.json 更新: ${OUT_FILE}`);
console.log(`   posts: ${result.posts}, followers: ${result.followers}, following: ${result.following}`);
