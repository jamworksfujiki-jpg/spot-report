/**
 * Google Ads ダッシュボードから過去30日間のデータを取得して
 * `src/lib/scraped-data/ads.json` に書き出す
 *
 * 必須: 事前に `npm run login:ads` で永続プロフィール + クッキーを保存しておく
 *
 * 流れ:
 *  1. 永続プロフィールで Edge を起動
 *  2. ダッシュボードへ
 *  3. 期間セレクタを「過去30日間」に変更
 *  4. ダウンロード → ZIP
 *  5. ZIP 展開 → CSV パース
 *  6. JSON 構造化して書き出し
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-ads');
const COOKIE_FILE = path.join(AUTH_DIR, 'google-ads.json');
const INFO_FILE = path.join(AUTH_DIR, 'googleAds-info.json');
const OUT_DIR = path.resolve(__dirname, '../src/lib/scraped-data');
const OUT_FILE = path.join(OUT_DIR, 'ads.json');

if (!fs.existsSync(PROFILE_DIR)) {
  console.error(`❌ プロフィールが存在しません: ${PROFILE_DIR}`);
  console.error('   先に `npm run login:ads` を実行してください');
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const info = fs.existsSync(INFO_FILE) ? JSON.parse(fs.readFileSync(INFO_FILE, 'utf8')) : {};
const DASHBOARD_URL = info.dashboardUrl;
const CUSTOMER_ID = (info.customerIds && info.customerIds[0]) || '989-421-6094';

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
const today = new Date();
const startDay = new Date(today);
startDay.setDate(startDay.getDate() - 30);
const expectedFrom = fmt(startDay);
const expectedTo = fmt(new Date(today.getTime() - 24 * 3600 * 1000));

console.log(`📊 Google Ads scrape: 期待期間 ${expectedFrom} ～ ${expectedTo}`);

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  channel: 'msedge',
  viewport: { width: 1440, height: 900 },
  locale: 'ja-JP',
  acceptDownloads: true,
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
  ignoreDefaultArgs: ['--enable-automation'],
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // @ts-ignore
  if (!window.chrome) window.chrome = { runtime: {} };
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

if (/Sign in|ログイン|accounts\.google\.com/i.test(page.url())) {
  console.error('❌ ログイン状態が失われています。`npm run login:ads` を実行してください');
  await context.close();
  process.exit(2);
}
console.log('✓ ログイン状態OK');

// 期間セレクタを「過去30日間」にセット
async function setDateRangeLast30() {
  console.log('  📅 期間を「過去30日間」に変更中...');
  // 日付セレクタは複数候補があるので順に試す
  const triggers = [
    'button:has-text("期間")',
    '[aria-label*="期間"]',
    '[aria-label*="日付"]',
    'button:has-text("Date")',
    'material-button:has-text("カスタム")',
  ];
  let opened = false;
  for (const sel of triggers) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        opened = true;
        console.log(`    トリガー検出: ${sel}`);
        break;
      }
    } catch { /* ignore */ }
  }
  if (!opened) {
    console.warn('  ⚠️  期間セレクタが見つかりません（UI 変更の可能性）');
    return false;
  }
  await page.waitForTimeout(1500);
  // 「過去30日間」をクリック
  const options = ['過去 30 日間', '過去30日間', 'Last 30 days'];
  for (const t of options) {
    try {
      const opt = page.locator(`text=/${t}/`).first();
      if (await opt.isVisible({ timeout: 2000 })) {
        await opt.click();
        console.log(`    選択: ${t}`);
        await page.waitForTimeout(5000); // データ再読込待ち
        return true;
      }
    } catch { /* ignore */ }
  }
  console.warn('  ⚠️  「過去30日間」オプションが見つかりません');
  // フォールバック: ESC で閉じる
  await page.keyboard.press('Escape');
  return false;
}

await setDateRangeLast30();

// ダウンロード
let downloadedZip = null;
try {
  console.log('  ⬇️  ダウンロードボタン検出中...');
  const downloadCandidates = [
    page.getByRole('button', { name: /ダウンロード/i }),
    page.getByRole('button', { name: /download/i }),
    page.locator('[aria-label*="ダウンロード"]'),
    page.locator('[aria-label*="Download"]'),
  ];
  let downloadBtn = null;
  for (const c of downloadCandidates) {
    try {
      const first = c.first();
      if (await first.isVisible({ timeout: 2000 })) {
        downloadBtn = first;
        break;
      }
    } catch { /* ignore */ }
  }
  if (downloadBtn) {
    await downloadBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    const formats = ['.zip', 'Excel.csv', 'CSV', 'ZIP'];
    for (const f of formats) {
      const opt = page.locator(`text=/${f}/i`).first();
      if (await opt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await opt.click();
        break;
      }
    }
    const download = await downloadPromise;
    downloadedZip = path.join(os.tmpdir(), `ads-${Date.now()}.zip`);
    await download.saveAs(downloadedZip);
    console.log(`  ✓ ZIP ダウンロード: ${downloadedZip}`);
  } else {
    console.warn('  ⚠️  ダウンロードボタンが見つかりません');
  }
} catch (e) {
  console.warn('  ⚠️  ダウンロード失敗:', e.message);
}

// クッキー更新
try {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
} catch { /* ignore */ }

await context.close();

// === ZIP パース ===
function parseCsv(text) {
  // ヘッダ + データ行を雑に分解（クォート対応の最小実装）
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}
function toYen(s) {
  if (s == null) return 0;
  return parseFloat(String(s).replace(/[¥￥\s,]/g, '')) || 0;
}
function toJpDate(s) {
  // "2026年3月25日(水)" → "2026-03-25"
  const m = String(s).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

let timeline = [];
let campaigns = [];
let totals = {};
let actualFrom = null, actualTo = null;

if (downloadedZip) {
  console.log('  📂 ZIP 展開中...');
  const extractDir = path.join(os.tmpdir(), `ads-extract-${Date.now()}`);
  fs.mkdirSync(extractDir, { recursive: true });
  try {
    // PowerShell の Expand-Archive を使う（Windows パスを正しく扱える）
    const psCmd = `Expand-Archive -Path '${downloadedZip}' -DestinationPath '${extractDir}' -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'pipe' });
    const files = fs.readdirSync(extractDir);
    console.log(`    ${files.length} ファイル抽出`);

    for (const file of files) {
      const full = path.join(extractDir, file);
      const text = fs.readFileSync(full, 'utf8');
      const { headers, rows } = parseCsv(text);

      // 期間.csv（日付ベースタイムライン）: 日付,クリック数,コンバージョン数,コンバージョン単価,費用
      if (file.startsWith('期間') && headers[0] === '日付') {
        const dateIdx = 0;
        const clicksIdx = headers.indexOf('クリック数');
        const convIdx = headers.indexOf('コンバージョン数');
        const cpaIdx = headers.indexOf('コンバージョン単価');
        const costIdx = headers.indexOf('費用');
        for (const r of rows) {
          if (!r[dateIdx]) continue;
          const d = toJpDate(r[dateIdx]);
          if (!d) continue;
          if (!actualFrom || d < actualFrom) actualFrom = d;
          if (!actualTo || d > actualTo) actualTo = d;
          const cost = toYen(r[costIdx]);
          const cpa = toYen(r[cpaIdx]);
          let conv = parseFloat(r[convIdx]) || 0;
          // 日次「コンバージョン数」が 0 でも 単価×日次費用 で逆算する
          if (conv === 0 && cpa > 0 && cost > 0) {
            conv = Math.round((cost / cpa) * 100) / 100;
          }
          timeline.push({
            date: d,
            clicks: parseInt(r[clicksIdx]) || 0,
            conversionsPrimary: 0,
            conversionsSecondary: 0,
            conversions: conv,
            cost,
          });
        }
      }

      // キャンペーン.csv: キャンペーン名,キャンペーン グループ名,キャンペーンのステータス,費用,コンバージョン数,コンバージョン単価
      if (file.startsWith('キャンペーン') && !file.includes('変化') && headers[0] === 'キャンペーン名') {
        const nameIdx = 0;
        const groupIdx = headers.indexOf('キャンペーン グループ名');
        const statusIdx = headers.indexOf('キャンペーンのステータス');
        const costIdx = headers.indexOf('費用');
        const convIdx = headers.indexOf('コンバージョン数');
        const cpaIdx = headers.indexOf('コンバージョン単価');
        for (const r of rows) {
          if (!r[nameIdx] || /^合計|^total/i.test(r[nameIdx])) continue;
          campaigns.push({
            name: r[nameIdx],
            group: groupIdx >= 0 ? r[groupIdx] || '' : '',
            status: statusIdx >= 0 ? r[statusIdx] : '',
            cost: toYen(r[costIdx]),
            conversions: parseFloat(r[convIdx]) || 0,
            cpa: toYen(r[cpaIdx]),
          });
        }
      }
    }
    console.log(`  ✓ timeline: ${timeline.length} 日, campaigns: ${campaigns.length} 件`);

    // campaigns CSV から totals を計算（daily より正確）
    if (campaigns.length) {
      const tClicks = timeline.reduce((s, t) => s + t.clicks, 0);
      const tCost = campaigns.reduce((s, c) => s + c.cost, 0);
      const tConv = campaigns.reduce((s, c) => s + c.conversions, 0);
      totals = {
        ...totals,
        clicks: tClicks,
        cost: tCost,
        conversions: Math.round(tConv * 100) / 100,
        cpc: tClicks ? Math.round(tCost / tClicks) : 0,
        cpa: tConv ? Math.round(tCost / tConv) : 0,
      };
    }
  } catch (e) {
    console.warn('  ⚠️  ZIP 展開/パース失敗:', e.message);
  }
}

const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {};

const result = {
  ...existing,
  customerId: CUSTOMER_ID,
  accountName: existing.accountName || 'スポット社労士くん',
  period: {
    from: actualFrom || expectedFrom,
    to: actualTo || expectedTo,
  },
  days: timeline.length || 30,
  totals: { ...(existing.totals || {}), ...totals },
  campaigns: campaigns.length ? campaigns : existing.campaigns || [],
  timeline: timeline.length ? timeline : existing.timeline || [],
  source: downloadedZip ? 'playwright-overview-zip' : 'playwright-no-zip',
  scrapedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`✅ ads.json 更新`);
console.log(`   実期間: ${result.period.from} ～ ${result.period.to}`);
console.log(`   totals: ${JSON.stringify(result.totals)}`);
console.log(`   campaigns: ${result.campaigns.length} 件, timeline: ${result.timeline.length} 日`);
