# Google Ads API セットアップ手順

サンクス到達CV を Google Ads API 経由で取得するための初回セットアップ。
**1度だけ実行すれば、以降は毎日自動で取得**されます。

---

## 0. 前提条件

- Google Ads Developer Token: `bUIOyfPKFD0heM2LMDaivA`（既存）
- アカウント: spot.sr.intern@gmail.com（Google Ads 操作権限あり）
- Google Ads Customer ID: `989-421-6094`
- MCC ID: `830-262-1107`
- **Basic Access が承認済みかは要確認**（テストアクセスのままだと API は動きません）

### Basic Access の確認
1. https://ads.google.com にログイン
2. **ツール → 設定 → API センター**
3. 「**Basic アクセス**」になっているか確認
   - **「テストアクセス」**のままなら、API センターで Basic 申請を再確認（既に承認済みのはず）

---

## 1. Google Cloud Console で OAuth 2.0 Client ID 作成

### 1-1. プロジェクトを選択
1. https://console.cloud.google.com/ を開く
2. プロジェクトドロップダウンで **`spot-report-ga4-53323`** を選択
   （GA4 用と同じプロジェクトでOK。ない場合は新規作成して `spot-report` 等の名前で）

### 1-2. Google Ads API を有効化
1. **APIとサービス → ライブラリ**
2. 検索ボックスに「Google Ads API」
3. **有効にする** ボタンクリック

### 1-3. OAuth 同意画面を設定
1. **APIとサービス → OAuth 同意画面**
2. もし未設定なら:
   - ユーザータイプ: **外部**（個人 Google アカウント使うため）
   - アプリ名: `spot-report-ads-api`
   - ユーザーサポートメール: 自分のメール
   - デベロッパーの連絡先: 自分のメール
   - スコープ: 後で追加なので空でOK
   - テストユーザー: **`spot.sr.intern@gmail.com` を追加**

### 1-4. OAuth Client ID 作成
1. **APIとサービス → 認証情報 → 認証情報を作成 → OAuth クライアント ID**
2. アプリケーションの種類: **デスクトップ アプリ**
3. 名前: `spot-report-ads-api-client`
4. 作成 → **クライアント ID と クライアント シークレットを控える**

---

## 2. ローカルに設定ファイル作成

`C:\Users\fujik\vscode\.reporting-auth\google-ads-api-config.json` に以下を保存：

```json
{
  "client_id": "ここに 1-4 のクライアント ID",
  "client_secret": "ここに 1-4 のクライアント シークレット",
  "developer_token": "bUIOyfPKFD0heM2LMDaivA",
  "customer_id": "989-421-6094",
  "login_customer_id": "830-262-1107"
}
```

---

## 3. OAuth 認可を1度だけ実施

PowerShell で：

```powershell
cd C:\Users\fujik\vscode\spot-report\scraper
npm run setup:ads-api
```

### 流れ
1. ローカルHTTPサーバが起動（localhost:8765）
2. ブラウザが**自動で開く**（Google 認可画面）
3. **spot.sr.intern@gmail.com** でログイン
4. 「**確認しました**」「**続行**」「**許可**」をクリック
5. 「✅ セットアップ完了」と表示されたら成功
6. PowerShell に戻ると `refresh_token` 保存メッセージ

### 失敗パターン
- 「警告：このアプリは Google で確認されていません」→ **詳細 → 「spot-report-ads-api（安全ではない）に移動」**をクリック（自分のアプリなのでOK）
- 「Error 400: redirect_uri_mismatch」→ Cloud Console の OAuth Client ID 設定で `http://localhost:8765/callback` を追加

---

## 4. 動作確認

```powershell
npm run scrape:cv-api
```

### 期待する出力
```
🎯 Google Ads API: cvActions (過去30日)
  ✓ N 行取得
✅ ads-cv-actions.json 更新
   total: N 種類 / 全CV: X
   サンクス到達: M 種類・合計 Y CV
     - 【始めの社労士くん】3サンクスページ到達: ... CV
     - 【新規適用届】2サンクスページ到達: ... CV
     - 【freee365】3サンクスページ到達: ... CV
```

これでサンクスCV が**現在の値**で取得できます。

---

## 5. 毎日自動実行への組み込み

セットアップ完了後、Windows タスクスケジューラ経由で `scrape-all.mjs` を実行すると、
`scrape-cv-actions-api.mjs` も自動で走り、ダッシュボードに最新サンクスCV が反映されます。
（`scrape-cv-actions.mjs` ※ Playwrightベース は不要になります）

---

## トラブルシューティング

### `Token refresh failed: invalid_grant`
→ refresh_token が失効。`npm run setup:ads-api` を再実行。

### `PERMISSION_DENIED: Developer token is not approved for production use`
→ Basic Access ではなくテストアクセスのまま。Google Ads → API センターで Basic 申請状況確認。

### `404 NOT_FOUND` または `customer not found`
→ `customer_id` または `login_customer_id` が間違っている。MCC 配下に該当 customer がいるか確認。
