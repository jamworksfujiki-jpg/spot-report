/**
 * Google Ads API（REST）で過去30日の実績を取得して `src/lib/scraped-data/ads.json` を書く。
 *
 * 【2026-09-25 新設】これまでは Playwright 版 (scrape-ads.mjs) が
 * 「Google広告の画面にログイン → レポートZIPをダウンロード → 展開」という経路を取っていたが、
 * ログインセッション失効・DOM変更・ZIP展開失敗のたびに壊れ、
 * 2026-09-06 を最後に19日間ダッシュボードが止まっていた（誰も気づけなかった）。
 * CVアクション側 (scrape-cv-actions-api.mjs) は refresh_token による API 経路で安定稼働していたため、
 * 実績データも同じ API 経路に寄せる。画面に依存しないので、ログイン切れでもDOM変更でも壊れない。
 *
 * 使い方: node scrape-ads-api.mjs
 * 前提  : setup-ads-api.mjs を1度実行して refresh_token 保存済み
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callApi, loadConfig } from './lib/google-ads-api.mjs';
import { failLoud, alertFailure } from './lib/fail-loud.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/lib/scraped-data');
const OUT_FILE = path.join(OUT_DIR, 'ads.json');
const NAME = 'Google広告 実績';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------- 期間（JST基準）
// Google Ads の LAST_30_DAYS は「昨日までの30日間」。
// 画面に出す from/to を自前で持たないと「過去30日」というラベルだけが独り歩きするため、
// 必ず実日付で持つ（CLAUDE.md「過去30日等のラベルは取得日と切り離して書かない」）。
function jstDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
// 検証用に期間を差し替えられるようにする（本番のタスクからは渡さない）。
// 例: ADS_FROM=2026-06-12 ADS_TO=2026-07-11 ADS_DRY_RUN=1 node scrape-ads-api.mjs
const TO = process.env.ADS_TO || jstDate(-1);
const FROM = process.env.ADS_FROM || jstDate(-30);
const DRY_RUN = process.env.ADS_DRY_RUN === '1';
const DATE_WHERE = `segments.date BETWEEN '${FROM}' AND '${TO}'`;

const config = loadConfig();
console.log(`🎯 Google Ads API: 実績 ${FROM} 〜 ${TO}`);

// ---------------------------------------------------------------- 取得ヘルパ
const yen = (micros) => Math.round(Number(micros || 0) / 1e6);
const num = (v) => Number(v || 0);
const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * クエリを投げる。失敗したら即 failLoud（＝書かない・古い時刻を保つ・メール通知・非ゼロ終了）。
 * 「一部だけ失敗して残りで書き込む」を許すと、欠けた数字が「最新」として表示される。
 */
async function must(label, query) {
  try {
    return await callApi({ query });
  } catch (e) {
    await failLoud({
      name: NAME,
      reason: `${label} の取得に失敗: ${e.message.split('\n').slice(0, 3).join(' / ')}`,
      outFile: OUT_FILE,
    });
  }
}

/** 補助的な内訳。落ちても本体は書けるが、取れなかったことは必ず記録する。 */
const degraded = [];
async function optional(label, query) {
  try {
    return await callApi({ query });
  } catch (e) {
    console.warn(`  ⚠️  ${label} は取得できませんでした: ${e.message.split('\n')[0]}`);
    degraded.push(label);
    return null;
  }
}

// ---------------------------------------------------------------- enum → 日本語
const STATUS_JA = { ENABLED: '有効', PAUSED: '一時停止', REMOVED: '削除済み' };
const DEVICE_JA = {
  DESKTOP: 'パソコン',
  MOBILE: '携帯電話',
  TABLET: 'タブレット',
  CONNECTED_TV: 'テレビ画面',
  OTHER: 'その他',
};
const NETWORK_JA = {
  SEARCH: 'Google 検索',
  SEARCH_PARTNERS: '検索パートナー',
  CONTENT: 'ディスプレイ ネットワーク',
  YOUTUBE: 'YouTube',
  YOUTUBE_SEARCH: 'YouTube 検索',
  YOUTUBE_WATCH: 'YouTube 動画',
  MIXED: 'ミックス',
  GOOGLE_TV: 'Google TV',
};
const MATCH_JA = { EXACT: '完全一致', PHRASE: 'フレーズ一致', BROAD: 'インテント マッチ' };
const GENDER_JA = { MALE: '男性', FEMALE: '女性', UNDETERMINED: '不明' };
const ageJa = (e) => {
  if (!e) return '不明';
  if (e === 'AGE_RANGE_UNDETERMINED') return '不明';
  if (e === 'AGE_RANGE_65_UP') return '65 歳以上';
  const m = /^AGE_RANGE_(\d+)_(\d+)$/.exec(e);
  return m ? `${m[1]}～${m[2]} 歳` : e;
};

// ---------------------------------------------------------------- 1. 全体合計
const totalsRows = await must('アカウント合計', `
  SELECT metrics.cost_micros, metrics.clicks, metrics.impressions,
         metrics.conversions, metrics.all_conversions
  FROM customer
  WHERE ${DATE_WHERE}
`);
const t = totalsRows[0]?.metrics || {};
const cost = yen(t.costMicros);
const clicks = num(t.clicks);
const impressions = num(t.impressions);
// 【CVの定義】画面の「コンバージョン」は metrics.conversions（＝主要CV／目標に設定されたもの）を使う。
// metrics.all_conversions は「リンククリック」「経路タップ」等の副次アクションまで含むため、
// 実績を大きく見せてしまう（2026-08 実績: 主要CV 4 に対し 全CV 104 ＝ 26倍）。
// 旧 Playwright 版もキャンペーン表の「コンバージョン」列＝主要CV を採っていたので、定義も揃う。
const conversions = round2(t.conversions);
const allConversions = round2(t.allConversions);

// ---------------------------------------------------------------- 2. 検索ネットワーク分
const netRows = await must('ネットワーク別', `
  SELECT segments.ad_network_type, metrics.cost_micros, metrics.clicks, metrics.impressions
  FROM customer
  WHERE ${DATE_WHERE}
`);
const network = netRows
  .map((r) => ({
    name: NETWORK_JA[r.segments?.adNetworkType] || r.segments?.adNetworkType || '不明',
    clicks: num(r.metrics?.clicks),
    cost: yen(r.metrics?.costMicros),
    cpc: num(r.metrics?.clicks) ? Math.round(yen(r.metrics?.costMicros) / num(r.metrics?.clicks)) : 0,
    impressions: num(r.metrics?.impressions),
  }))
  .filter((r) => r.clicks || r.cost || r.impressions)
  .sort((a, b) => b.cost - a.cost);

const searchRows = netRows.filter((r) => /^SEARCH/.test(r.segments?.adNetworkType || ''));
const searchImpressions = searchRows.reduce((s, r) => s + num(r.metrics?.impressions), 0);
const searchClicks = searchRows.reduce((s, r) => s + num(r.metrics?.clicks), 0);

// ---------------------------------------------------------------- 3. キャンペーン別
const campRows = await must('キャンペーン別', `
  SELECT campaign.name, campaign.status,
         metrics.cost_micros, metrics.clicks, metrics.impressions,
         metrics.conversions, metrics.all_conversions
  FROM campaign
  WHERE ${DATE_WHERE}
`);
const campaigns = campRows
  .map((r) => {
    const c = yen(r.metrics?.costMicros);
    const cv = round2(r.metrics?.conversions);
    return {
      name: r.campaign?.name || '',
      group: '',
      status: STATUS_JA[r.campaign?.status] || r.campaign?.status || '',
      cost: c,
      clicks: num(r.metrics?.clicks),
      impressions: num(r.metrics?.impressions),
      conversions: cv,
      allConversions: round2(r.metrics?.allConversions),
      cpa: cv ? Math.round(c / cv) : 0,
    };
  })
  // 配信のなかったキャンペーンは一覧を埋めるだけなので落とす。
  // ただし1本も残らない場合は「全キャンペーン停止中」として後段で明示する。
  .filter((c) => c.cost || c.clicks || c.impressions || c.conversions)
  .sort((a, b) => b.cost - a.cost);

// ---------------------------------------------------------------- 4. 日別推移
const tlRows = await must('日別推移', `
  SELECT segments.date, metrics.cost_micros, metrics.clicks,
         metrics.conversions, metrics.all_conversions
  FROM customer
  WHERE ${DATE_WHERE}
  ORDER BY segments.date
`);
// API は実績のない日を返さないので、欠けた日を 0 で埋めて連続した折れ線にする。
// （0 で埋めるのは「その日の実績が確かに 0 だった」ことが API の応答から言えるため。
//   取得失敗時は上の must() が止めるので、ここに来た時点で期間全体が取得済み。）
const byDate = new Map(
  tlRows.map((r) => [
    r.segments?.date,
    {
      clicks: num(r.metrics?.clicks),
      cost: yen(r.metrics?.costMicros),
      conversions: round2(r.metrics?.allConversions),
      conversionsPrimary: round2(r.metrics?.conversions),
    },
  ])
);
const timeline = [];
for (let d = new Date(`${FROM}T00:00:00Z`); d <= new Date(`${TO}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
  const key = d.toISOString().slice(0, 10);
  const v = byDate.get(key) || { clicks: 0, cost: 0, conversions: 0, conversionsPrimary: 0 };
  timeline.push({
    date: key,
    clicks: v.clicks,
    conversionsPrimary: v.conversionsPrimary,
    conversionsSecondary: round2(v.conversions - v.conversionsPrimary),
    // 折れ線の「コンバージョン」も合計と同じ主要CVで揃える（allConversions は別枠で持つ）
    conversions: v.conversionsPrimary,
    allConversions: v.conversions,
    cost: v.cost,
  });
}

// ---------------------------------------------------------------- 5. 内訳（欠けても本体は出す）
const devRows = await optional('デバイス別', `
  SELECT segments.device, metrics.cost_micros, metrics.clicks, metrics.all_conversions
  FROM customer
  WHERE ${DATE_WHERE}
`);
const devices = (devRows || [])
  .map((r) => ({
    device: DEVICE_JA[r.segments?.device] || r.segments?.device || '不明',
    cost: yen(r.metrics?.costMicros),
    clicks: num(r.metrics?.clicks),
    conversions: round2(r.metrics?.allConversions),
  }))
  .filter((d) => d.cost || d.clicks || d.conversions)
  .sort((a, b) => b.cost - a.cost);

const stRows = await optional('検索語句', `
  SELECT search_term_view.search_term, metrics.cost_micros, metrics.clicks,
         metrics.impressions, metrics.all_conversions
  FROM search_term_view
  WHERE ${DATE_WHERE}
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`);
const searchTerms = (stRows || []).map((r) => ({
  term: r.searchTermView?.searchTerm || '',
  cost: yen(r.metrics?.costMicros),
  clicks: num(r.metrics?.clicks),
  impressions: num(r.metrics?.impressions),
  conversions: round2(r.metrics?.allConversions),
}));

const kwRows = await optional('入札キーワード', `
  SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
         ad_group_criterion.status, metrics.cost_micros, metrics.clicks, metrics.ctr
  FROM keyword_view
  WHERE ${DATE_WHERE}
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`);
const biddedKeywords = (kwRows || []).map((r) => ({
  keyword: r.adGroupCriterion?.keyword?.text || '',
  matchType: MATCH_JA[r.adGroupCriterion?.keyword?.matchType] || r.adGroupCriterion?.keyword?.matchType || '',
  status: STATUS_JA[r.adGroupCriterion?.status] || r.adGroupCriterion?.status || '',
  cost: yen(r.metrics?.costMicros),
  clicks: num(r.metrics?.clicks),
  ctr: round2(num(r.metrics?.ctr) * 100),
}));

function demoRows(rows, labelOf) {
  const list = (rows || [])
    .map((r) => ({ label: labelOf(r), impressions: num(r.metrics?.impressions) }))
    .filter((d) => d.impressions);
  const total = list.reduce((s, d) => s + d.impressions, 0);
  return list
    .map((d) => ({ ...d, share: total ? round2((d.impressions / total) * 100) : 0 }))
    .sort((a, b) => b.impressions - a.impressions);
}
const gender = demoRows(
  await optional('性別', `
    SELECT ad_group_criterion.gender.type, metrics.impressions
    FROM gender_view
    WHERE ${DATE_WHERE}
  `),
  (r) => GENDER_JA[r.adGroupCriterion?.gender?.type] || '不明'
);
const age = demoRows(
  await optional('年齢', `
    SELECT ad_group_criterion.age_range.type, metrics.impressions
    FROM age_range_view
    WHERE ${DATE_WHERE}
  `),
  (r) => ageJa(r.adGroupCriterion?.ageRange?.type)
);

// ---------------------------------------------------------------- 6. 配信が止まっている理由の特定
// 「¥0・CV0」をそのまま出すと、好調に見えないだけで済まされてしまう。
// 出稿が死んでいるなら、その理由まで一緒に画面へ運ぶ。
let deliveryBlock = null;
if (!impressions && !cost) {
  const adRows = await optional('有効キャンペーンの広告審査状況', `
    SELECT campaign.name, ad_group_ad.status,
           ad_group_ad.policy_summary.approval_status,
           ad_group_ad.policy_summary.review_status,
           ad_group_ad.policy_summary.policy_topic_entries
    FROM ad_group_ad
    WHERE campaign.status = 'ENABLED'
  `);
  const enabledCampaigns = campRows.filter((r) => r.campaign?.status === 'ENABLED');
  const disapproved = (adRows || []).filter(
    (r) => r.adGroupAd?.policySummary?.approvalStatus === 'DISAPPROVED'
  );
  deliveryBlock = {
    enabledCampaigns: enabledCampaigns.map((r) => r.campaign?.name),
    servableAds: (adRows || []).length,
    disapprovedAds: disapproved.map((r) => ({
      campaign: r.campaign?.name,
      approvalStatus: r.adGroupAd?.policySummary?.approvalStatus,
      reviewStatus: r.adGroupAd?.policySummary?.reviewStatus,
      policies: (r.adGroupAd?.policySummary?.policyTopicEntries || []).map((p) => `${p.topic} (${p.type})`),
    })),
    reason: !enabledCampaigns.length
      ? '有効なキャンペーンが1本もありません（すべて一時停止/削除済み）'
      : disapproved.length
        ? `有効キャンペーンの広告が不承認です: ${disapproved
            .map((r) => (r.adGroupAd?.policySummary?.policyTopicEntries || []).map((p) => p.topic).join(','))
            .join(' / ')}`
        : '有効キャンペーンはありますが、期間中の表示が0でした（予算・入札・審査中などを確認してください）',
  };
}

// ---------------------------------------------------------------- 7. 書き出し
const result = {
  customerId: config.customer_id,
  accountName: 'スポット社労士くん',
  period: { from: FROM, to: TO },
  days: 30,
  totals: {
    cost,
    clicks,
    conversions,
    allConversions,
    impressions,
    searchImpressions,
    searchClicks,
    cpc: clicks ? Math.round(cost / clicks) : 0,
    cpa: conversions ? Math.round(cost / conversions) : 0,
    searchCtr: searchImpressions ? round2((searchClicks / searchImpressions) * 100) : 0,
  },
  campaigns,
  timeline,
  devices,
  searchTerms,
  biddedKeywords,
  network,
  gender,
  age,
  dataQuality: {
    timelineAvailable: true,
    timelineNote: null,
    campaignRowsAvailable: true,
    noActiveCampaigns: !campaigns.length,
    // 配信ゼロは「取得失敗」ではなく「本当に出ていない」。両者を取り違えないよう明示的に持つ。
    noDelivery: !impressions && !cost,
    deliveryBlock,
    degraded,
    source: 'google-ads-api',
  },
  source: 'google-ads-api',
  scrapedAt: new Date().toISOString(),
};

if (DRY_RUN) {
  console.log('🧪 ADS_DRY_RUN=1 のためファイルは書き換えません');
} else {
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
}
console.log(`✅ ads.json 更新（${FROM}〜${TO}）`);
console.log(`   費用 ¥${cost} / クリック ${clicks} / 表示 ${impressions} / 主要CV ${conversions} / 全CV ${allConversions}`);
console.log(`   キャンペーン ${campaigns.length} 本 / 日別 ${timeline.length} 日分`);
if (degraded.length) console.log(`   ⚠️ 取得できなかった内訳: ${degraded.join(', ')}`);

// 配信ゼロは事故なので、静かに ¥0 を表示して終わらせない。
if (result.dataQuality.noDelivery) {
  console.warn(`\n🚨 期間中の配信がゼロです: ${deliveryBlock?.reason}`);
  if (DRY_RUN) {
    console.log('🧪 ADS_DRY_RUN=1 のためアラートは送りません');
    process.exit(0);
  }
  await alertFailure({
    subject: '[spot-report] Google広告の配信が止まっています（表示0・費用¥0）',
    body:
      `Google広告 ${FROM}〜${TO} の30日間、表示回数も費用もゼロでした。\n\n` +
      `理由: ${deliveryBlock?.reason}\n` +
      (deliveryBlock?.disapprovedAds?.length
        ? `不承認の広告:\n${deliveryBlock.disapprovedAds
            .map((a) => `  - ${a.campaign}: ${a.policies.join(', ')}`)
            .join('\n')}\n\n`
        : '\n') +
      `有効キャンペーン: ${deliveryBlock?.enabledCampaigns?.join(', ') || 'なし'}\n\n` +
      `ポリシー マネージャー: https://ads.google.com/aw/policymanager\n` +
      `ダッシュボード: https://spot-report.vercel.app\n`,
  });
}
