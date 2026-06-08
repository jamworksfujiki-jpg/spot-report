# spot-report スクレイパー

毎朝 Google 広告 と Instagram のデータを取得して `src/lib/scraped-data/` 配下の
JSON を更新する。GA4 は Service Account 直接続なのでスクレイプ不要。

## 構成

| ファイル | 役割 |
|---|---|
| `login-ads.mjs` | Playwright を `headless: false` で立ち上げて Google Ads にログイン。完了時にクッキーを `../../.reporting-auth/google-ads.json` に保存 |
| `login-instagram.mjs` | 同上、Instagram用。`../../.reporting-auth/ig-session.json` に保存 |
| `scrape-ads.mjs` | 保存済みクッキーで Google Ads ダッシュボードを開き、データを取得して `src/lib/scraped-data/ads.json` に書き出す |
| `scrape-instagram.mjs` | 同上、Instagram プロフィール統計を `instagram.json` へ |
| `scrape-all.mjs` | 上記2つを順に呼び、git add/commit/push まで実行 |

## 初回セットアップ手順

```powershell
cd C:\Users\fujik\vscode\spot-report\scraper
npm install
npm run login:ads
# → Edge が立ち上がる。Google Ads にログイン完了後、PowerShellに戻ってEnter
npm run login:ig
# → 同様に Instagram にログイン完了後、PowerShellに戻ってEnter
```

**注意**: Edge が必要です（システムインストール済の Microsoft Edge を起動します）。
永続プロフィール (`.reporting-auth/edge-profile-*`) に保存されるので、一度ログインすれば
以降のスクレイプは自動でログイン状態を再利用します。

## 日次運用

```powershell
npm run scrape:all
# → ads.json + instagram.json 更新 → git push → Vercel 自動デプロイ
```

## Windows タスクスケジューラ登録

`register-task.ps1` を管理者 PowerShell で実行すると、毎朝 7:00 JST に自動で
`npm run scrape:all` が走る設定が登録される。

## クッキー期限

- Google Ads: 数日〜数週間で期限切れ → `npm run login:ads` を再実行
- Instagram: 数十日 → `npm run login:ig` を再実行

scrape スクリプトはクッキー期限切れ検知時に自動で警告ログを残す。
