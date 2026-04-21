import { NextResponse } from "next/server";
import { GA4_PROPERTIES } from "@/lib/ga4";

export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let serviceAccountEmail: string | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      serviceAccountEmail = parsed.client_email ?? null;
    } catch { /* ignore */ }
  }
  return NextResponse.json({
    configured: !!raw,
    serviceAccountEmail,
    properties: GA4_PROPERTIES,
    setupGuide: {
      step1: "Google Cloud Consoleで新規プロジェクト作成（例: spot-report-ga4）",
      step2: "APIライブラリで「Google Analytics Data API」を有効化",
      step3: "IAM＞サービスアカウント作成→JSONキーをダウンロード",
      step4: `ダウンロードしたJSONの全文をVercel環境変数GOOGLE_SERVICE_ACCOUNT_JSONに貼り付け`,
      step5: `このページに表示されるサービスアカウントのメールアドレスを、GA4管理画面の各プロパティで「閲覧者」として追加（${GA4_PROPERTIES.length}プロパティ）`,
    },
  });
}
