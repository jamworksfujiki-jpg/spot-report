/**
 * Google Ads API の OAuth 初回セットアップ
 * 使い方: node setup-ads-api.mjs
 *
 * 事前に C:\Users\fujik\vscode\.reporting-auth\google-ads-api-config.json を作成しておく:
 * {
 *   "client_id": "xxx.apps.googleusercontent.com",
 *   "client_secret": "GOCSPX-xxx",
 *   "developer_token": "bUIOyfPKFD0heM2LMDaivA",
 *   "customer_id": "989-421-6094",
 *   "login_customer_id": "830-262-1107"
 * }
 *
 * 実行すると：
 *  1. ローカルHTTPサーバ起動（localhost:8765）
 *  2. ブラウザで Google OAuth 画面が開く
 *  3. spot.sr.intern@gmail.com でログイン → 認可
 *  4. リダイレクトで auth_code を受け取り、refresh_token に交換
 *  5. .reporting-auth/google-ads-tokens.json に保存
 */
import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, saveTokens } from './lib/google-ads-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const TOKENS_FILE = path.join(AUTH_DIR, 'google-ads-tokens.json');

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/adwords';

const config = loadConfig();
console.log('🔐 Google Ads API OAuth セットアップ');
console.log(`   client_id: ${config.client_id.slice(0, 20)}...`);
console.log(`   customer_id: ${config.customer_id}`);
console.log(`   login_customer_id (MCC): ${config.login_customer_id}`);

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end('Not found');
    return;
  }
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>エラー: ${error}</h1>`);
    console.error(`❌ OAuth エラー: ${error}`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>No code in callback</h1>');
    server.close();
    process.exit(1);
  }

  console.log('✓ 認可コード受信、トークン取得中...');
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: HTTP ${tokenRes.status} ${JSON.stringify(tokenData)}`);
    }
    if (!tokenData.refresh_token) {
      throw new Error('refresh_token が返ってきませんでした（過去に認可済みの可能性。アプリの「サードパーティアプリ」管理から削除して再実行）');
    }

    const saved = {
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
      obtained_at: Date.now(),
    };
    saveTokens(saved);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      '<h1>✅ セットアップ完了</h1><p>このタブは閉じて構いません。PowerShell のウィンドウに戻ってください。</p>'
    );

    console.log(`✅ refresh_token を ${TOKENS_FILE} に保存しました`);
    console.log(`   有効期限: ${tokenData.expires_in} 秒（access_token）`);
    console.log(`   refresh_token は失効まで使い回します`);
    console.log('');
    console.log('次のステップ: node scrape-cv-actions-api.mjs を実行して動作確認');

    server.close();
    process.exit(0);
  } catch (e) {
    console.error('❌ トークン取得失敗:', e.message);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>エラー</h1><pre>${e.message}</pre>`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 ローカル HTTP サーバ起動: ${REDIRECT_URI}`);
  console.log('');
  console.log('以下の URL をブラウザで開いてください（自動で開きます）:');
  console.log(authUrl);
  console.log('');
  // Windows のデフォルトブラウザで開く
  spawn('cmd', ['/c', 'start', '', authUrl], { detached: true, stdio: 'ignore' }).unref();
});

server.on('error', (e) => {
  console.error('❌ HTTP サーバ起動失敗:', e.message);
  process.exit(1);
});
