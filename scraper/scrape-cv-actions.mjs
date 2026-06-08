/**
 * Google Ads「目標 / コンバージョン」ページからアクション別 CV 内訳を取得し
 * `src/lib/scraped-data/ads-cv-actions.json` に書き出す
 *
 * 使い方: node scrape-cv-actions.mjs
 * 前提: `npm run login:ads` で永続プロフィールを作成済
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-ads');
const INFO_FILE = path.join(AUTH_DIR, 'googleAds-info.json');
const OUT_DIR = path.resolve(__dirname, '../src/lib/scraped-data');
const OUT_FILE = path.join(OUT_DIR, 'ads-cv-actions.json');

if (!fs.existsSync(PROFILE_DIR)) {
  console.error(`❌ プロフィールが存在しません: ${PROFILE_DIR}`);
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const info = fs.existsSync(INFO_FILE) ? JSON.parse(fs.readFileSync(INFO_FILE, 'utf8')) : {};
const CUSTOMER_ID = (info.customerIds && info.customerIds[0]) || '989-421-6094';

// 概要URLから ocid/euid を抽出してコンバージョン画面URLを作る（まず概要に行って「設定」へ）
const DASH = info.dashboardUrl || '';
const params = DASH.match(/[\?&][^=]+=[^&]*/g)?.join('') || '';
const CONV_URL = `https://ads.google.com/aw/conversions${params}`;

console.log(`🎯 Google Ads cvActions scrape (30日間)`);
console.log(`   URL: ${CONV_URL}`);

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  channel: 'msedge',
  viewport: { width: 1440, height: 900 },
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
await page.goto(CONV_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

if (/Sign in|ログイン|accounts\.google\.com/i.test(page.url())) {
  console.error('❌ ログイン状態が失われています。`npm run login:ads` を実行してください');
  await context.close();
  process.exit(2);
}
console.log('✓ ログイン状態OK');

// 左サイドバーの「設定」をクリックしてアクション一覧へ遷移
async function gotoSettings() {
  const candidates = [
    page.locator('a:has-text("設定"), button:has-text("設定")').filter({ hasNotText: /管理/ }),
    page.locator('[aria-label="設定"]'),
    page.locator('nav a').filter({ hasText: '設定' }),
  ];
  for (const c of candidates) {
    try {
      const el = c.first();
      if (await el.isVisible({ timeout: 3000 })) {
        console.log('  ➡️  「設定」リンクをクリック');
        await el.click();
        await page.waitForTimeout(5000);
        return true;
      }
    } catch { /* ignore */ }
  }
  console.warn('  ⚠️  「設定」リンクが見つからない');
  return false;
}
await gotoSettings();

// 期間を「過去30日間」にセット
async function setDateRangeLast30() {
  // 「過去30日間を表示」ボタンが直接出ていることが多い
  try {
    const quickBtn = page.locator('text=/過去\\s*30\\s*日間を表示/').first();
    if (await quickBtn.isVisible({ timeout: 2000 })) {
      await quickBtn.click();
      console.log('  📅 「過去30日間を表示」ボタンをクリック');
      await page.waitForTimeout(5000);
      return true;
    }
  } catch { /* ignore */ }

  // フォールバック: 期間トリガーを開いてオプション選択
  const triggers = [
    'button:has-text("期間")',
    '[aria-label*="期間"]',
    '[aria-label*="日付"]',
    'material-button:has-text("カスタム")',
  ];
  for (const sel of triggers) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        break;
      }
    } catch { /* ignore */ }
  }
  await page.waitForTimeout(1500);
  const options = ['過去 30 日間', '過去30日間', 'Last 30 days'];
  for (const t of options) {
    try {
      const opt = page.locator(`text=/${t}/`).first();
      if (await opt.isVisible({ timeout: 2000 })) {
        await opt.click();
        console.log(`  📅 期間: ${t} に設定`);
        await page.waitForTimeout(5000);
        return true;
      }
    } catch { /* ignore */ }
  }
  console.warn('  ⚠️  期間選択UIが見つからない、現在の設定で続行');
  return false;
}
await setDateRangeLast30();

// テーブルが描画されるまで明示的に待つ
async function waitForTable() {
  try {
    // Google Ads のコンバージョン一覧テーブル候補
    await page.waitForSelector(
      'ess-cell, [role="row"] [role="cell"], .conv-name, mat-cell',
      { timeout: 15000 }
    );
  } catch { /* ignore */ }
  await page.waitForTimeout(3000);
}
await waitForTable();

// テーブルから行を抽出（複数の DOM パターンに対応）
async function extractRows() {
  console.log('  📋 コンバージョンアクション抽出中...');
  const items = await page.evaluate(() => {
    const out = [];
    const seen = new Set();

    // (1) Material grid pattern: [role="row"] groups
    const groups = document.querySelectorAll('[role="rowgroup"]');
    for (const g of groups) {
      const rows = g.querySelectorAll('[role="row"]');
      for (const r of rows) {
        const cells = Array.from(r.querySelectorAll('[role="gridcell"], [role="cell"]')).map(c => c.textContent?.trim() || '');
        if (cells.length < 2) continue;
        // 名前は左から最初の長文字テキストセル
        const name = cells.find(c => c.length > 2 && !/^[¥￥\d.,%\s\-]+$/.test(c)) || '';
        if (!name || seen.has(name) || /^(合計|Total|フィルタ)/i.test(name)) continue;
        seen.add(name);
        // 数値セル抽出
        const nums = cells
          .map(c => parseFloat(c.replace(/[¥￥,\s]/g, '')))
          .filter(n => !isNaN(n));
        out.push({
          name,
          category: '',
          source: 'ウェブサイト',
          allConversions: nums[0] ?? 0,
          primaryConversions: nums[1] ?? 0,
          value: nums[2] ?? 0,
          rawCells: cells,
        });
      }
    }

    // (2) Plain <tr> table fallback
    if (out.length === 0) {
      const trs = document.querySelectorAll('table tr');
      for (const tr of trs) {
        const cells = Array.from(tr.querySelectorAll('td')).map(c => c.textContent?.trim() || '');
        if (cells.length < 2) continue;
        const name = cells[0];
        if (!name || seen.has(name) || /合計|Total/i.test(name)) continue;
        seen.add(name);
        const nums = cells.slice(1).map(c => parseFloat(c.replace(/[¥￥,\s]/g, ''))).filter(n => !isNaN(n));
        out.push({
          name,
          category: '',
          source: 'ウェブサイト',
          allConversions: nums[0] ?? 0,
          primaryConversions: nums[1] ?? 0,
          value: nums[2] ?? 0,
          rawCells: cells,
        });
      }
    }
    return out;
  });
  return items;
}

let items = await extractRows();
console.log(`  抽出: ${items.length} アクション`);

if (items.length === 0) {
  // デバッグ: スクリーンショットと HTML を保存
  const dbgImg = path.join(AUTH_DIR, 'cv-actions-debug.png');
  const dbgHtml = path.join(AUTH_DIR, 'cv-actions-debug.html');
  await page.screenshot({ path: dbgImg, fullPage: true });
  fs.writeFileSync(dbgHtml, await page.content());
  console.warn(`  ⚠️  抽出0件。デバッグ用ファイル: ${dbgImg} / ${dbgHtml}`);
}

await context.close();

// デバッグ用 rawCells を除去
items = items.map(({ rawCells, ...rest }) => rest);

const result = {
  customerId: CUSTOMER_ID,
  period: '過去30日',
  scrapedAt: new Date().toISOString(),
  total: items.length,
  totalAllConversions: Math.round(items.reduce((s, i) => s + i.allConversions, 0) * 100) / 100,
  totalPrimaryConversions: Math.round(items.reduce((s, i) => s + i.primaryConversions, 0) * 100) / 100,
  hasAllConversionsColumn: true,
  items: items.sort((a, b) => b.allConversions - a.allConversions),
};

// 抽出0件のときは既存ファイルを保持（古いデータを上書きしない）
if (items.length === 0 && fs.existsSync(OUT_FILE)) {
  console.warn(`⚠️  抽出0件のため既存の ads-cv-actions.json を保持しました`);
  process.exit(1);
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`✅ ads-cv-actions.json 更新`);
console.log(`   total: ${result.total} 種類 / 全CV: ${result.totalAllConversions}`);
const thanks = items.filter(i => /サンクス|thanks|完了|送信完了/i.test(i.name));
const thanksSum = thanks.reduce((s, i) => s + i.allConversions, 0);
console.log(`   サンクス到達: ${thanks.length} 種類・合計 ${Math.round(thanksSum * 100) / 100} CV`);
