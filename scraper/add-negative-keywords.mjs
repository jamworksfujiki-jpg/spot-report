/**
 * 04.税理士提携 に「他社名」の除外キーワードを追加する。
 *
 * 背景（2026-08-14）:
 *   配信キーワード9件はすべて BROAD（部分一致）で、除外キーワードが 0 件だった。
 *   そのため 3,418 種類もの検索語句に反応し、他社の事務所名検索にも費用が出ていた。
 *
 * 選別方針:
 *   ○ 含める … 明確に他社の固有名詞（事務所名・法人名）
 *   × 含めない … 地名（東京/千葉/中央区/銀座 等）、一般語（近くの/社会保険 等）
 *      これらは「近所の社労士を探している見込み客」であり、遮断してはいけない。
 *      実際 "近くの社労士事務所" は CV3件、"所沢社労士事務所" は CV5件を生んでいる。
 *
 * 実行: node add-negative-keywords.mjs           … 検証のみ
 *       node add-negative-keywords.mjs --apply   … 実際に追加
 */
import { loadConfig, loadTokens, refreshAccessToken, saveTokens, normalizeCustomerId } from './lib/google-ads-api.mjs';
import { callApi } from './lib/google-ads-api.mjs';

const API_VERSION = 'v22';
const APPLY = process.argv.includes('--apply');
const CAMPAIGN_NAME = '04.税理士提携';

// 独自性が高く、単体で他社と判別できるブランド名
const BRAND_TOKENS = [
  'スクエアワン', 'リタクラウド', 'コンセルト', 'オーレンス', 'フェリタス',
  'キャシュモ', 'ポラリス', 'キャストグローバル', 'ベンチャーサポート', 'アールワン',
  'エンチカ', 'アクタス', 'コンパッソ', 'チアレッジ', 'ソラーレ', 'ミネルバ',
  'エキップ', 'アークアンドパートナーズ', 'おむろ人事サービス', 'ウイニング', 'スクラム',
];

// 姓・英字略称など単体では一般的すぎるため、事務所名まで含めて指定
const FULL_NAMES = [
  '佐藤社会保険労務士法人', 'sato社会保険労務士法人', 'sato社労士法人',
  '赤星社会保険労務士事務所', '鈴木社会保険労務士事務所', '木村社会保険労務士事務所',
  '藤田社会保険労務士事務所', '福田社労士事務所', '曽我社会保険労務士事務所',
  '北見社会保険労務士事務所', '舟木事務所', '坂の上社労士事務所',
  'bsp社会保険労務士法人', 'asc社会保険労務士法人', 'toss社労士事務所',
  'awork社会保険労務士法人', 'atl社会保険労務士法人', 'tsc社会保険労務士法人',
  'sc社会保険労務士法人', 'yorisou社会保険労務士法人',
];

const NEGATIVES = [...BRAND_TOKENS, ...FULL_NAMES];

const config = loadConfig();
let tokens = loadTokens();
const expiresAt = (tokens.obtained_at || 0) + (tokens.expires_in || 0) * 1000 - 60_000;
if (!tokens.access_token || Date.now() > expiresAt) {
  const fresh = await refreshAccessToken({
    clientId: config.client_id, clientSecret: config.client_secret, refreshToken: tokens.refresh_token,
  });
  tokens = { ...tokens, ...fresh };
  saveTokens(tokens);
}
const cid = normalizeCustomerId(config.customer_id);

const camp = await callApi({ query: `SELECT campaign.id, campaign.name FROM campaign WHERE campaign.name = '${CAMPAIGN_NAME}'` });
if (!camp.length) { console.error(`キャンペーン「${CAMPAIGN_NAME}」が見つかりません`); process.exit(1); }
const campaignId = camp[0].campaign.id;
console.log(`対象キャンペーン: ${CAMPAIGN_NAME} (id=${campaignId})`);

const operations = NEGATIVES.map((text) => ({
  create: {
    campaign: `customers/${cid}/campaigns/${campaignId}`,
    negative: true,
    keyword: { text, matchType: 'PHRASE' },
  },
}));

console.log(`\n追加する除外キーワード ${NEGATIVES.length} 件（すべてフレーズ一致）`);
NEGATIVES.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t}`));
console.log(`\nモード: ${APPLY ? '★本番適用' : '検証のみ（変更しません）'}`);

const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/campaignCriteria:mutate`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${tokens.access_token}`,
    'developer-token': config.developer_token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ operations, partialFailure: false, validateOnly: !APPLY }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`\n❌ 失敗: HTTP ${res.status}`);
  console.error(text.slice(0, 2000));
  process.exit(1);
}
const json = JSON.parse(text);
console.log(`\n✅ ${APPLY ? '追加しました' : '検証OK（構文・権限とも問題なし）'}`);
console.log(`   結果件数: ${(json.results || []).length}`);
if (!APPLY) console.log('\n実際に適用するには --apply を付けて再実行してください');
