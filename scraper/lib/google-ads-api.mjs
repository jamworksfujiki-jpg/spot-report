/**
 * Google Ads API（REST） 軽量クライアント
 * OAuth refresh_token から access_token を取得し、searchStream を叩く。
 *
 * 依存: なし（fetch のみ）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../../.reporting-auth');
const TOKENS_FILE = path.join(AUTH_DIR, 'google-ads-tokens.json');
const CONFIG_FILE = path.join(AUTH_DIR, 'google-ads-api-config.json');

// Google Ads API REST バージョン。
// 【2026-07-31】v20 は廃止され UNSUPPORTED_VERSION で全リクエストが弾かれていた
// （"Version v20 is deprecated. Requests to this version will be blocked."）。
// 実測で v21 が利用可能。Googleは定期的に旧バージョンを打ち切るため、
// UNSUPPORTED_VERSION が出たらここを上げること。
const API_VERSION = 'v21';

export function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      `${CONFIG_FILE} が存在しません。setup-ads-api.mjs を先に実行してください`
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

export function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) {
    throw new Error(
      `${TOKENS_FILE} が存在しません。setup-ads-api.mjs を先に実行してください`
    );
  }
  return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
}

export function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

/**
 * refresh_token を使って新しい access_token を取得
 */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: HTTP ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    obtained_at: Date.now(),
  };
}

/**
 * customer_id をハイフン除去（API は数字のみ）
 */
export function normalizeCustomerId(id) {
  return String(id).replace(/-/g, '');
}

/**
 * Google Ads API searchStream エンドポイントに GAQL クエリを投げる
 */
export async function searchStream({
  accessToken,
  developerToken,
  loginCustomerId,
  customerId,
  query,
}) {
  const cid = normalizeCustomerId(customerId);
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) {
    headers['login-customer-id'] = normalizeCustomerId(loginCustomerId);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    // JSONなら主要なエラーメッセージを抽出して見やすくする。
    // 【2026-07-31 修正】旧実装は循環参照ガードも深さ制限も無い再帰で、
    // エラー応答の形によってはスタックを食い潰してプロセスごと異常終了していた
    // (Windows exit code 3221226505 = 0xC0000409)。そのため「APIが何を返したか」が
    // 一切わからないまま CV アクション取得が毎日死んでいた。
    let detail = text.slice(0, 2000);
    try {
      const json = JSON.parse(text);
      const errs = [];
      const seenObjects = new WeakSet();
      const collect = (obj, depth) => {
        if (depth > 12 || errs.length > 50) return;
        if (!obj || typeof obj !== 'object') return;
        if (seenObjects.has(obj)) return; // 循環参照ガード
        seenObjects.add(obj);
        if (typeof obj.message === 'string') errs.push(`message: ${obj.message}`);
        if (obj.errorCode) errs.push(`errorCode: ${JSON.stringify(obj.errorCode)}`);
        if (typeof obj.status === 'string') errs.push(`status: ${obj.status}`);
        for (const v of Object.values(obj)) collect(v, depth + 1);
      };
      collect(json, 0);
      if (errs.length) {
        const seen = new Set();
        detail = errs.filter((e) => !seen.has(e) && seen.add(e)).slice(0, 10).join('\n');
      }
    } catch {
      // JSONでなければ生テキストをそのまま使う（ここで throw しない）
    }
    throw new Error(`API call failed: HTTP ${res.status}\n${detail}`);
  }
  // searchStream はストリーミングだが、まとめて配列で返ってくる
  const data = await res.json();
  // [{ results: [...] }, { results: [...] }] → flatten
  if (Array.isArray(data)) {
    return data.flatMap((batch) => batch.results || []);
  }
  return data.results || [];
}

/**
 * 高レベル API: トークン更新付きで呼ぶ
 */
export async function callApi({ query }) {
  const config = loadConfig();
  let tokens = loadTokens();

  // access_token が期限切れなら refresh
  const expiresAt = (tokens.obtained_at || 0) + (tokens.expires_in || 0) * 1000 - 60_000;
  if (!tokens.access_token || Date.now() > expiresAt) {
    console.log('  🔄 access_token を refresh しています...');
    const fresh = await refreshAccessToken({
      clientId: config.client_id,
      clientSecret: config.client_secret,
      refreshToken: tokens.refresh_token,
    });
    tokens = { ...tokens, ...fresh };
    saveTokens(tokens);
  }

  // 【2026-07-31 追加】認可したアカウントによって login-customer-id の要否が変わる。
  //  - spot.sr.intern@gmail.com … 989-421-6094 に直接権限があるため不要
  //  - jamworksfujiki@gmail.com  … MCC(830-262-1107) 経由のため必要
  // どちらで認可されても動くよう、設定値 → MCC → 無し の順で試す。
  const candidates = [];
  if (config.login_customer_id) candidates.push(config.login_customer_id);
  candidates.push(null);            // 直接権限（2026-07-31 実測でこれが通る）
  candidates.push('830-262-1107');  // スポット社労士くん MCC 経由

  const tried = [];
  let lastErr = null;
  for (const loginCustomerId of candidates) {
    if (tried.includes(String(loginCustomerId))) continue;
    tried.push(String(loginCustomerId));
    try {
      return await searchStream({
        accessToken: tokens.access_token,
        developerToken: config.developer_token,
        loginCustomerId,
        customerId: config.customer_id,
        query,
      });
    } catch (e) {
      lastErr = e;
      // 権限・認証まわりのエラーだけ次の候補を試す。それ以外（クエリ不正等）は即座に投げる
      if (!/PERMISSION|AUTHENTICATION|AUTHORIZATION|USER_PERMISSION|HTTP 40[13]/i.test(e.message)) {
        throw e;
      }
      console.log(`  ↩︎ login-customer-id=${loginCustomerId ?? 'なし'} で失敗、次の候補を試します`);
    }
  }
  throw lastErr;
}
