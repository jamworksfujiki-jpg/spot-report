/**
 * コンバージョンアクションの「主要目標(primary_for_goal)」を一括で見直す。
 *
 * 背景（2026-08-04）:
 *   04.税理士提携 を再開した直後（8/3）に計上された「コンバージョン3件」は、
 *   すべて【共通】全てのリンククリックだった。入札戦略が MAXIMIZE_CONVERSIONS の
 *   ため、自動入札が「リンクをクリックする人」を最適化対象として学習してしまう。
 *
 * 方針:
 *   - 「途中経過」（フォーム入力開始・ページ遷移・リンククリック）→ 副次目標に降格
 *   - 「完了」（サンクスページ到達・申込完了）と「電話」→ 主要目標のまま維持
 *     ※ 電話は税理士提携の最大の成果（通話72件・262分）のため外さない
 *
 * primary_for_goal=false にすると、そのアクションは
 *   ・計測は継続される（コンバージョン数には引き続き計上される）
 *   ・すべてのキャンペーンで入札の最適化対象から外れる
 * 実行: node set-conversion-goals.mjs           … 検証のみ（変更しない）
 *       node set-conversion-goals.mjs --apply   … 実際に変更する
 */
import { loadConfig, loadTokens, refreshAccessToken, saveTokens, normalizeCustomerId } from './lib/google-ads-api.mjs';

const API_VERSION = 'v22';
const APPLY = process.argv.includes('--apply');

// 主要目標から外す（＝入札の最適化対象から外す）アクション
const DEMOTE = [
  { id: '6799127705', name: '【共通】全てのリンククリック' },
  { id: '6831944760', name: '【始めの社労士くん】1問い合わせページ遷移' },
  { id: '6831950283', name: '【始めの社労士くん】2フォーム入力開始' },
  { id: '830529337',  name: '【新規適用届】1フォーム入力開始' },
  { id: '6486603501', name: '【freee365】1問い合わせフォーム遷移' },
  { id: '7331556881', name: '【freee365】2フォーム入力開始' },
  { id: '7532556646', name: '【産休育休応援キャンペーン】1キャンペーン申込フォーム遷移' },
  { id: '7532556649', name: '【産休育休応援キャンペーン】2フォーム入力開始' },
  { id: '7550336084', name: '【給与伴走くん】１フォーム入力開始' },
  { id: '7679592363', name: '【年度更新】1フォーム入力開始' },
];

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

const operations = DEMOTE.map((a) => ({
  update: { resourceName: `customers/${cid}/conversionActions/${a.id}`, primaryForGoal: false },
  updateMask: 'primaryForGoal',
}));

console.log(`対象 ${DEMOTE.length} 件を「副次目標」に変更します`);
DEMOTE.forEach((a) => console.log(`  - ${a.name}`));
console.log(`\nモード: ${APPLY ? '★本番適用' : '検証のみ（変更しません）'}`);

const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/conversionActions:mutate`, {
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
  console.error(text.slice(0, 1500));
  process.exit(1);
}
const json = JSON.parse(text);
console.log(`\n✅ ${APPLY ? '変更を適用しました' : '検証OK（構文・権限とも問題なし）'}`);
console.log(`   結果件数: ${(json.results || []).length}`);
if (!APPLY) console.log('\n実際に適用するには --apply を付けて再実行してください');
