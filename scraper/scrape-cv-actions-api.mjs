/**
 * Google Ads API（REST）でコンバージョンアクション別 CV 取得
 * 使い方: node scrape-cv-actions-api.mjs
 * 前提: setup-ads-api.mjs を1度実行して refresh_token 保存済み
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callApi, loadConfig } from './lib/google-ads-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/lib/scraped-data');
const OUT_FILE = path.join(OUT_DIR, 'ads-cv-actions.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const config = loadConfig();

console.log(`🎯 Google Ads API: cvActions (過去30日)`);

// GAQL: conversion_action 別の集計
// metrics.all_conversions = 全種別CV、 metrics.conversions = 主要CV
// (1) アクション別の30日合計
const query = `
  SELECT
    conversion_action.name,
    conversion_action.category,
    conversion_action.type,
    conversion_action.status,
    metrics.all_conversions,
    metrics.all_conversions_value
  FROM conversion_action
  WHERE segments.date DURING LAST_30_DAYS
    AND metrics.all_conversions > 0
  ORDER BY metrics.all_conversions DESC
`;

// (2) 日付×アクション別の内訳（いつ発生したか）
const dailyQuery = `
  SELECT
    segments.date,
    segments.conversion_action_name,
    metrics.all_conversions
  FROM customer
  WHERE segments.date DURING LAST_30_DAYS
    AND metrics.all_conversions > 0
  ORDER BY segments.date DESC
`;

let results, dailyResults;
try {
  results = await callApi({ query });
  dailyResults = await callApi({ query: dailyQuery });
} catch (e) {
  console.error('❌ API 呼び出し失敗:', e.message);
  console.error('   1. refresh_token が有効か → setup-ads-api.mjs を再実行');
  console.error('   2. Developer Token が Basic access か → ads.google.com で確認');
  console.error('   3. customer_id / login_customer_id が正しいか確認');
  process.exit(1);
}

console.log(`  ✓ アクション別: ${results.length} 行, 日付別: ${dailyResults.length} 行`);

// カテゴリ enum を日本語に
function categoryLabel(cat) {
  const map = {
    PAGE_VIEW: 'ページビュー',
    PURCHASE: '購入',
    LEAD: 'リード',
    SUBMIT_LEAD_FORM: 'リードフォーム送信',
    BOOK_APPOINTMENT: '予約',
    SIGNUP: '登録',
    REQUEST_QUOTE: '見積もり依頼',
    GET_DIRECTIONS: '道順',
    OUTBOUND_CLICK: '外部リンククリック',
    CONTACT: '問い合わせ',
    ENGAGEMENT: 'エンゲージメント',
    STORE_VISIT: '来店',
    STORE_SALE: '店舗販売',
    DEFAULT: 'デフォルト',
    QUALIFIED_LEAD: 'リード（適格）',
    CONVERTED_LEAD: 'リード（変換）',
    DOWNLOAD: 'ダウンロード',
    ADD_TO_CART: 'カートに追加',
    BEGIN_CHECKOUT: '購入手続き開始',
    SUBSCRIBE_PAID: '有料登録',
    PHONE_CALL_LEAD: '電話リード',
    IMPORTED_LEAD: 'インポート済リード',
    SHOW_LINEUP: 'メニュー表示',
    SIGNED_UP_FOR_EMAIL: 'メール登録',
    REQUEST_CALLBACK: 'コールバック依頼',
    READ_NEWS_LETTER: 'ニュースレター閲覧',
    READ_ARTICLE: '記事閲覧',
    WATCH_TRAILER: 'トレーラー視聴',
    EXPLORE_PROPERTY: '物件閲覧',
    REQUEST_TRIAL: '無料試用申込',
    JOIN_REWARDS: '会員登録',
    PLAY_GAME: 'ゲーム参加',
    INVITE_FRIENDS: '友人招待',
    SHARE: 'シェア',
    INTERACTION: 'インタラクション',
  };
  return map[cat] || cat || '';
}

const items = results.map((r) => {
  const action = r.conversionAction || {};
  const m = r.metrics || {};
  return {
    name: action.name || '',
    category: categoryLabel(action.category),
    type: action.type || '',
    status: action.status || '',
    source: 'ウェブサイト',
    allConversions: Math.round((parseFloat(m.allConversions) || 0) * 100) / 100,
    primaryConversions: Math.round((parseFloat(m.conversions) || 0) * 100) / 100,
    allConversionsValue: parseFloat(m.allConversionsValue) || 0,
    value: parseFloat(m.conversionsValue) || 0,
  };
});

const totalAll = items.reduce((s, i) => s + i.allConversions, 0);
const totalPrim = items.reduce((s, i) => s + i.primaryConversions, 0);

// 日付×アクション別の内訳（いつ発生したか）
const daily = dailyResults.map((r) => ({
  date: r.segments?.date || '',
  actionName: r.segments?.conversionActionName || '',
  count: Math.round((parseFloat(r.metrics?.allConversions) || 0) * 100) / 100,
}))
.filter((d) => d.date && d.actionName && d.count > 0)
.sort((a, b) => b.date.localeCompare(a.date));

const result = {
  customerId: config.customer_id,
  period: '過去30日',
  scrapedAt: new Date().toISOString(),
  total: items.length,
  totalAllConversions: Math.round(totalAll * 100) / 100,
  totalPrimaryConversions: Math.round(totalPrim * 100) / 100,
  hasAllConversionsColumn: true,
  source: 'google-ads-api',
  items,
  daily, // 日付×アクション別の内訳
};

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`✅ ads-cv-actions.json 更新`);
console.log(`   total: ${result.total} 種類 / 全CV: ${result.totalAllConversions}`);

const thanksItems = items.filter((i) => /サンクス|thanks|完了|送信完了/i.test(i.name));
const thanksSum = thanksItems.reduce((s, i) => s + i.allConversions, 0);
console.log(`   サンクス到達: ${thanksItems.length} 種類・合計 ${Math.round(thanksSum * 100) / 100} CV`);
thanksItems.forEach((i) => {
  console.log(`     - ${i.name}: ${i.allConversions} CV`);
});
