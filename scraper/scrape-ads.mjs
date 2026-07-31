/**
 * Google Ads から過去30日間のデータを取得して `src/lib/scraped-data/ads.json` に書き出す
 *
 * 必須: 事前に `npm run login:ads` で永続プロフィールを保存しておく
 *
 * 【2026-07-31 全面改修】
 * 旧実装の致命的な欠陥:
 *   - データ取得元が「概要(overview)」ページのウィジェットZIPだけだった。
 *     全キャンペーンが一時停止されると概要ウィジェットは全部ゼロを返すため、
 *     実際には ¥57,017 使っているのに ¥0 の CSV が落ちてきていた。
 *   - 取得に失敗しても前回値を書き戻し、scrapedAt だけ今の時刻にして
 *     「✅ ads.json 更新」と表示し exit 0 していた（サイレント失敗）。
 *     結果、2026-07-12 以降ずっと ¥125,627 という古い数字を
 *     「最新データ」として上司向けレポートに出し続けていた。
 *
 * 新実装:
 *   1. 主データは「キャンペーン」ページのテーブルを DOM から直接読む。
 *      → 一時停止・削除済みキャンペーンでも実績が取れる（概要ページより信頼できる）
 *   2. 日別タイムラインは概要ページのZIPから取得（ベストエフォート）。
 *      全部ゼロなのに総額が非ゼロなら「取得できなかった」と判断して空にする。
 *   3. 取れなかったら **ファイルを書かずに exit 3 + メール通知**。
 *      古い数字に新しいタイムスタンプを打つことは絶対にしない。
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';
import { failLoud } from './lib/fail-loud.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-ads');
const COOKIE_FILE = path.join(AUTH_DIR, 'google-ads.json');
const INFO_FILE = path.join(AUTH_DIR, 'googleAds-info.json');
const OUT_DIR = path.resolve(__dirname, '../src/lib/scraped-data');
const OUT_FILE = path.join(OUT_DIR, 'ads.json');
const NAME = 'Google広告';

if (!fs.existsSync(PROFILE_DIR)) {
  console.error(`❌ プロフィールが存在しません: ${PROFILE_DIR}`);
  console.error('   先に `npm run login:ads` を実行してください');
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const info = fs.existsSync(INFO_FILE) ? JSON.parse(fs.readFileSync(INFO_FILE, 'utf8')) : {};
const OVERVIEW_URL = info.dashboardUrl;
const CAMPAIGNS_URL = (OVERVIEW_URL || '').replace('/aw/overview', '/aw/campaigns');
const CUSTOMER_ID = (info.customerIds && info.customerIds[0]) || '989-421-6094';

if (!OVERVIEW_URL) {
  await failLoud({ name: NAME, reason: 'googleAds-info.json に dashboardUrl がありません', outFile: OUT_FILE });
}

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const today = new Date();
const startDay = new Date(today); startDay.setDate(startDay.getDate() - 30);
const expectedFrom = fmt(startDay);
const expectedTo = fmt(new Date(today.getTime() - 24 * 3600 * 1000));

console.log(`📊 ${NAME} scrape: 期待期間 ${expectedFrom} ～ ${expectedTo}`);

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  channel: 'msedge',
  viewport: { width: 1900, height: 1100 },
  locale: 'ja-JP',
  acceptDownloads: true,
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
  ignoreDefaultArgs: ['--enable-automation'],
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  if (!window.chrome) window.chrome = { runtime: {} };
});

const page = context.pages()[0] || (await context.newPage());

/** 失敗時に必ずブラウザを閉じてから failLoud する */
async function abort(reason) {
  try { await context.close(); } catch { /* ignore */ }
  await failLoud({ name: NAME, reason, outFile: OUT_FILE });
}

// ---------------------------------------------------------------- 1. ログイン確認
await page.goto(CAMPAIGNS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
if (/accounts\.google\.com|ServiceLogin/i.test(page.url())) {
  await abort('Google広告のログイン状態が失われています。`npm run login:ads` で再ログインが必要です');
}
console.log('✓ ログイン状態OK');

// ---------------------------------------------------------------- 2. 期間を過去30日間に
async function setLast30Days() {
  const triggers = ['[aria-label*="期間"]', 'button:has-text("期間")', '[aria-label*="日付"]', 'button:has-text("Date")'];
  for (const sel of triggers) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2500 })) {
        await el.click();
        await page.waitForTimeout(1500);
        for (const t of ['過去 30 日間', '過去30日間', 'Last 30 days']) {
          const opt = page.locator(`text=/${t}/`).first();
          if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
            await opt.click();
            await page.waitForTimeout(8000);
            console.log(`  📅 期間を「${t}」に設定`);
            return true;
          }
        }
        await page.keyboard.press('Escape').catch(() => {});
        return false;
      }
    } catch { /* 次の候補へ */ }
  }
  return false;
}
await setLast30Days();
await page.waitForTimeout(4000);

// 画面に表示されている期間ラベルを読み取って実期間を確定する
async function readDisplayedRange() {
  const txt = await page.evaluate(() => document.body.innerText);
  // 「2026年7月1日～30日」/「2026年6月30日～7月29日」/「2026年7月1日～2026年7月30日」
  let m = txt.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*[～~]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日/);
  if (!m) return null;
  const y1 = +m[1], mo1 = +m[2], d1 = +m[3];
  const y2 = m[4] ? +m[4] : y1;
  const mo2 = m[5] ? +m[5] : mo1;
  const d2 = +m[6];
  const p = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { from: p(y1, mo1, d1), to: p(y2, mo2, d2) };
}
const displayed = await readDisplayedRange();
if (!displayed) {
  await abort('画面から集計期間を読み取れませんでした（Google広告のUI変更の可能性）');
}
console.log(`  ✓ 画面上の集計期間: ${displayed.from} ～ ${displayed.to}`);

// ---------------------------------------------------------------- 3. キャンペーン表を DOM から取得
function yen(s) {
  if (s == null) return null;
  const v = String(s).replace(/[¥￥\s,]/g, '');
  if (!v || v === '—' || v === '-') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
function num(s) {
  if (s == null) return null;
  const v = String(s).replace(/[\s,]/g, '').replace(/クリック数|回|件/g, '');
  if (!v || v === '—' || v === '-') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

const table = await page.evaluate(() => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/help_outline|expand_more|arrow_drop_down/g, '').trim();
  const headers = [...document.querySelectorAll('ess-cell-header, [role="columnheader"]')].map((h) => clean(h.innerText));
  const rows = [...document.querySelectorAll('ess-particle-table-row, [role="row"]')]
    .map((r) => [...r.querySelectorAll('ess-cell, [role="gridcell"], [role="cell"]')].map((c) => clean(c.innerText)))
    .filter((cells) => cells.length > 3);
  return { headers, rows };
});

if (!table.headers.length || !table.rows.length) {
  await abort('キャンペーン表を読み取れませんでした（Google広告のUI変更、または表が描画される前にタイムアウト）');
}

// ヘッダ名 → 行内の位置を対応づける。
// 行の先頭には選択チェックボックス等の余分なセルが入るため、
// 「キャンペーン」列の位置を基準にオフセットを合わせる。
const hIndex = (label) => table.headers.findIndex((h) => h === label);
function pick(cells, label) {
  const hi = hIndex(label);
  if (hi < 0) return null;
  const offset = cells.length - table.headers.length;
  const i = hi + Math.max(0, offset);
  return cells[i] ?? null;
}

const totalRow = table.rows.find((cells) => cells.some((c) => /^合計:\s*アカウント/.test(c)));
if (!totalRow) {
  await abort('キャンペーン表に「合計: アカウント」行が見つかりませんでした（UI変更の可能性）');
}

const totals = {
  cost: yen(pick(totalRow, '費用')),
  clicks: num(pick(totalRow, 'クリック数')),
  conversions: num(pick(totalRow, 'コンバージョン')),
  impressions: num(pick(totalRow, '表示回数')),
  cpc: yen(pick(totalRow, '平均クリック単価')),
  cpa: yen(pick(totalRow, 'コンバージョン単価')),
};

// ★核心の検証: 総額が取れていなければ、絶対に書かずに落とす
if (totals.cost === null || totals.clicks === null) {
  await abort(
    `「合計: アカウント」行から費用/クリック数を取得できませんでした ` +
    `(cost=${totals.cost}, clicks=${totals.clicks})。Google広告の列構成が変わった可能性があります`
  );
}

// 個別キャンペーン行（合計行・下書き行・見出し行を除外）
const campaigns = table.rows
  .filter((cells) => {
    const name = pick(cells, 'キャンペーン') || '';
    if (!name) return false;
    if (/^合計:/.test(name)) return false;
    if (/進行中の下書き|有効なキャンペーンがありません/.test(name)) return false;
    return yen(pick(cells, '費用')) !== null;
  })
  .map((cells) => ({
    name: pick(cells, 'キャンペーン'),
    group: '',
    status: pick(cells, 'ステータス') || '',
    cost: yen(pick(cells, '費用')) ?? 0,
    conversions: num(pick(cells, 'コンバージョン')) ?? 0,
    cpa: yen(pick(cells, 'コンバージョン単価')) ?? 0,
  }));

console.log(`  ✓ 合計: 費用 ¥${totals.cost.toLocaleString()} / ${totals.clicks}クリック / CV ${totals.conversions}`);
console.log(`  ✓ 個別キャンペーン行: ${campaigns.length} 件`);

// アカウントに有効なキャンペーンが1つも無い状態を検知して記録する（黙って0にしない）
const noActiveCampaigns = await page.evaluate(() =>
  /有効なキャンペーンがありません|どの広告も掲載されていません/.test(document.body.innerText)
);
if (noActiveCampaigns) {
  console.log('  ⚠️  このアカウントには現在「有効なキャンペーン」がありません（全て一時停止/削除済み）');
}

// ---------------------------------------------------------------- 4. 日別タイムライン（概要ページZIP・ベストエフォート）
let timeline = [];
let timelineNote = null;

try {
  await page.goto(OVERVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  await setLast30Days();

  let zip = null;
  const candidates = [
    page.getByRole('button', { name: /ダウンロード/i }),
    page.locator('[aria-label*="ダウンロード"]'),
    page.getByRole('button', { name: /download/i }),
  ];
  for (const c of candidates) {
    try {
      const first = c.first();
      if (!(await first.isVisible({ timeout: 2000 }))) continue;
      await first.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      const dp = page.waitForEvent('download', { timeout: 30000 });
      for (const f of ['.zip', 'Excel.csv', 'CSV', 'ZIP']) {
        const opt = page.locator(`text=/${f}/i`).first();
        if (await opt.isVisible({ timeout: 1000 }).catch(() => false)) { await opt.click(); break; }
      }
      const d = await dp;
      zip = path.join(os.tmpdir(), `ads-${Date.now()}.zip`);
      await d.saveAs(zip);
      break;
    } catch { await page.keyboard.press('Escape').catch(() => {}); }
  }

  if (zip) {
    const dir = path.join(os.tmpdir(), `ads-extract-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${dir}' -Force"`, { stdio: 'pipe' });
    for (const file of fs.readdirSync(dir)) {
      if (!file.startsWith('期間')) continue;
      const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).filter((l) => l.trim());
      const head = lines[0].split(',');
      const ci = { clicks: head.indexOf('クリック数'), conv: head.indexOf('コンバージョン数'), cost: head.indexOf('費用') };
      for (const line of lines.slice(1)) {
        const c = line.split(',');
        const m = String(c[0]).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (!m) continue;
        timeline.push({
          date: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
          clicks: num(c[ci.clicks]) ?? 0,
          conversionsPrimary: 0,
          conversionsSecondary: 0,
          conversions: num(c[ci.conv]) ?? 0,
          cost: yen(c[ci.cost]) ?? 0,
        });
      }
    }
  } else {
    timelineNote = '概要ページからZIPをダウンロードできませんでした';
  }
} catch (e) {
  timelineNote = `日別データ取得で例外: ${e.message}`;
}

// 総額が非ゼロなのに日別が全部ゼロ = 概要ウィジェットが実績を返していない。
// ゼロを本物として書き込むと ¥0 表示になるので、空にして「無い」と明示する。
const timelineSum = timeline.reduce((s, d) => s + (d.cost || 0), 0);
if (timeline.length && timelineSum === 0 && totals.cost > 0) {
  timelineNote =
    '概要ページの日別データが全てゼロでした（有効なキャンペーンが無い場合に発生）。日別グラフは非表示にします';
  timeline = [];
}
if (timelineNote) console.log(`  ⚠️  日別データ: ${timelineNote}`);
else console.log(`  ✓ 日別データ: ${timeline.length}日 (合計 ¥${timelineSum.toLocaleString()})`);

// クッキー更新
try {
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ cookies: await context.cookies(), savedAt: new Date().toISOString() }, null, 2));
} catch { /* ignore */ }
await context.close();

// ---------------------------------------------------------------- 5. 書き出し（ここに来た時点で totals は本物）
const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {};

const result = {
  customerId: CUSTOMER_ID,
  accountName: existing.accountName || 'スポット社労士くん',
  period: { from: displayed.from, to: displayed.to },
  days: timeline.length || 30,
  totals: {
    cost: totals.cost,
    clicks: totals.clicks,
    conversions: totals.conversions ?? 0,
    impressions: totals.impressions ?? 0,
    cpc: totals.cpc ?? (totals.clicks ? Math.round(totals.cost / totals.clicks) : 0),
    cpa: totals.cpa ?? (totals.conversions ? Math.round(totals.cost / totals.conversions) : 0),
  },
  campaigns,
  timeline,
  // データ品質を明示する。UI 側はこれを見て「無い」ものを 0 と偽らずに済む
  dataQuality: {
    timelineAvailable: timeline.length > 0,
    timelineNote,
    campaignRowsAvailable: campaigns.length > 0,
    noActiveCampaigns,
    source: 'playwright-campaigns-table',
  },
  source: 'playwright-campaigns-table',
  scrapedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log('\n✅ ads.json を実データで更新しました');
console.log(`   期間  : ${result.period.from} ～ ${result.period.to}`);
console.log(`   費用  : ¥${result.totals.cost.toLocaleString()}`);
console.log(`   クリック: ${result.totals.clicks}`);
console.log(`   CV    : ${result.totals.conversions}`);
console.log(`   キャンペーン: ${campaigns.length}件 / 日別: ${timeline.length}日`);
if (noActiveCampaigns) {
  console.log('\n⚠️  注意: 現在このアカウントに有効なキャンペーンはありません（配信停止中）');
}
