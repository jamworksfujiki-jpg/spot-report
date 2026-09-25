/**
 * spot-report の鮮度監視（日次スクレイプとは独立に走らせる最後の安全網）
 *
 * 【2026-09-25 新設】なぜ必要か:
 *   scrape-all.mjs は末尾で失敗アラートを送るが、それは「最後まで到達できたとき」だけ。
 *   実際には 2026-09-06 以降、Playwright ステップが15分のタスク上限を食い潰して
 *   タスクスケジューラに 0x41306 で強制終了され、アラートのコードに到達しないまま
 *   19日間ダッシュボードが止まり、誰も気づけなかった。
 *   「ジョブが自分の失敗を報告する」仕組みは、ジョブごと死ぬと沈黙する。
 *   だから、ジョブの外から「データが古くなっていないか」だけを見る監視を別に置く。
 *
 * 判定は scrapedAt の古さのみ。ジョブが動いたかどうかではなく、
 * 「画面に出ている数字が古くないか」を見るので、原因が何であれ検知できる。
 *
 * 使い方: node check-freshness.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { alertFailure, hardExit } from './lib/fail-loud.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/lib/scraped-data');

// 許容する古さ（日）。日次ジョブなので2日分の猶予を持たせる。
const TARGETS = [
  { file: 'ads.json', label: 'Google広告 実績', maxAgeDays: 2 },
  { file: 'ads-cv-actions.json', label: 'Google広告 CVアクション', maxAgeDays: 2 },
  { file: 'instagram.json', label: 'Instagram', maxAgeDays: 2 },
];

const now = Date.now();
const stale = [];
const ok = [];

for (const t of TARGETS) {
  const p = path.join(DATA_DIR, t.file);
  if (!fs.existsSync(p)) {
    stale.push({ ...t, scrapedAt: null, ageDays: Infinity, note: 'ファイルが存在しません' });
    continue;
  }
  let scrapedAt = null;
  try {
    scrapedAt = JSON.parse(fs.readFileSync(p, 'utf8')).scrapedAt || null;
  } catch (e) {
    stale.push({ ...t, scrapedAt: null, ageDays: Infinity, note: `JSONが壊れています: ${e.message}` });
    continue;
  }
  if (!scrapedAt) {
    stale.push({ ...t, scrapedAt: null, ageDays: Infinity, note: 'scrapedAt がありません' });
    continue;
  }
  const ageDays = (now - new Date(scrapedAt).getTime()) / 86400000;
  const row = { ...t, scrapedAt, ageDays, note: null };
  (ageDays > t.maxAgeDays ? stale : ok).push(row);
}

const jst = (iso) =>
  iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '(なし)';
const line = (r) =>
  `  - ${r.label}: ${jst(r.scrapedAt)}` +
  (Number.isFinite(r.ageDays) ? `（${r.ageDays.toFixed(1)}日前）` : '') +
  (r.note ? ` ※${r.note}` : '');

for (const r of [...stale, ...ok]) console.log(line(r));

if (stale.length) {
  await alertFailure({
    subject: `[spot-report] データが更新されていません（${stale.map((s) => s.label).join(' / ')}）`,
    body:
      `spot-report のダッシュボードに出ている数字が古くなっています。\n` +
      `日次ジョブ (SpotReport-DailyScrape) が動いていないか、途中で強制終了された可能性があります。\n\n` +
      `【古いデータ】\n${stale.map(line).join('\n')}\n\n` +
      (ok.length ? `【正常】\n${ok.map(line).join('\n')}\n\n` : '') +
      `確認手順:\n` +
      `  1. タスクスケジューラで SpotReport-DailyScrape の前回実行結果を見る\n` +
      `     （0x41306 = 実行時間上限による強制終了）\n` +
      `  2. cd C:\\Users\\fujik\\vscode\\spot-report\\scraper\n` +
      `  3. node scrape-all.mjs を手動実行してエラーを確認\n` +
      `  4. ログ: C:\\Users\\fujik\\vscode\\spot-report\\scraper\\logs\\\n\n` +
      `ダッシュボード: https://spot-report.vercel.app\n`,
  });
  console.error(`\n🔴 ${stale.length} 件が古くなっています`);
  await hardExit(1);
}

// 監視自体の生存確認。毎週月曜に1通だけ届く。
// これが来なくなったら「監視が止まった」サインとして扱う。
const nowJst = new Date(now + 9 * 3600 * 1000);
if (nowJst.getUTCDay() === 1) {
  await alertFailure({
    subject: '[spot-report] 鮮度監視 正常稼働中（週次ハートビート）',
    body:
      `spot-report のデータはすべて最新です。\n\n${ok.map(line).join('\n')}\n\n` +
      `この通知は毎週月曜に届きます。届かなくなったら監視自体が止まっています。\n` +
      `ダッシュボード: https://spot-report.vercel.app\n`,
  });
}

console.log('\n✅ すべて最新です');
