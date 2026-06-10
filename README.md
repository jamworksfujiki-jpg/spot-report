# spot-report

スポット社労士くん 統合レポート（Google広告・GA4・Instagram）

URL: https://spot-report.vercel.app

## ENV 設定の注意（重要・2026-06-10 復旧経験あり）

### bcrypt ハッシュ等、`$` を含む値は base64 でラップして保存する

**症状**: `vercel env add NAME --value '$2b$10$rsv...'` を実行すると、Vercel CLI が `$XX` を環境変数として展開してしまい、**値が黙って truncate される**（成功報告されるが11文字程度しか保存されない）。

**対処**: `$` を含む値は base64 エンコードして別名で保存し、アプリ側でデコードする。

#### 設定方法（PowerShell）

```powershell
$hash = '$2b$10$rsvgGtSNCGo2Kulc43N0UOvO5m8bigAZ5BWorXxh2W.4LygJR2clu'  # bcrypt hash
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($hash))
vercel env add ADMIN_PASSWORD_HASH_B64 production --value $b64 --yes --scope=e-gov-spotportal
vercel deploy --prod --force --scope=e-gov-spotportal
```

#### 新しいパスワードのハッシュ生成

```powershell
cd c:\Users\fujik\vscode\spot-report
node -e "const b=require('bcryptjs'); console.log(b.hashSync('NEW_PASSWORD', 10));"
```

### 必須 env 変数

| 名前 | 値の例 | 用途 |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | ログインID |
| `ADMIN_PASSWORD_HASH_B64` | base64(bcrypt hash) | ログインパスワード。**生のbcryptを `ADMIN_PASSWORD_HASH` に入れてはいけない**（上記バグで壊れる）|
| `JWT_SECRET` | 64文字以上のランダム文字列 | セッションJWT署名 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON文字列 | GA4 API認証 |

### env 設定が正しいか runtime で確認したいとき

一時デバッグエンドポイントを作って実値長を確認する：

```ts
// src/app/api/debug-env/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  const b = process.env.ADMIN_PASSWORD_HASH_B64;
  const d = b ? Buffer.from(b, "base64").toString("utf-8") : "";
  return NextResponse.json({
    b64_length: b?.length ?? 0,
    decoded_length: d.length,
    looks_like_bcrypt: /^\$2[aby]?\$\d{2}\$/.test(d),
  });
}
```

middleware の `PUBLIC_PATHS` に `/api/debug-env` を一時追加し、確認後に **必ず削除** すること。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000

## デプロイ

```bash
vercel deploy --prod --scope=e-gov-spotportal
```
