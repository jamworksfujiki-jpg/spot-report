"use client";
import { useEffect, useState } from "react";

type StatusRes = {
  configured: boolean;
  serviceAccountEmail: string | null;
  properties: readonly { id: string; name: string; primary: boolean; siteUrl: string }[];
  setupGuide: Record<string, string>;
};

export default function SetupPage() {
  const [status, setStatus] = useState<StatusRes | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/ga4/status").then((r) => r.json()).then(setStatus);
  }, []);

  const email = status?.serviceAccountEmail;

  const copy = (v: string) => {
    navigator.clipboard.writeText(v).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <header className="mb-8">
        <a href="/" className="text-[13px] text-[#0071E3] hover:underline">← ダッシュボードに戻る</a>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-[#1D1D1F]">GA4 Data API セットアップ</h1>
        <p className="mt-1 text-[14px] text-[#6E6E73]">Google Analytics を Service Account でライブ接続する手順（所要5〜10分）</p>
      </header>

      <section className="card mb-6">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">接続状況</h2>
        {!status ? (
          <p className="text-[13px] text-[#6E6E73]">読み込み中...</p>
        ) : status.configured ? (
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#E5F7EB] text-[#0F7B32] border border-[#A8E5BD]">
              ✓ Vercelに GOOGLE_SERVICE_ACCOUNT_JSON 設定済み
            </span>
            {email && (
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 px-3 py-2 bg-[#F5F5F7] rounded-lg text-[13px] font-mono text-[#1D1D1F] break-all">{email}</code>
                <button
                  onClick={() => copy(email)}
                  className="px-3 py-2 text-[12px] font-medium rounded-lg bg-[#0071E3] text-white hover:bg-[#0051A3] min-h-[44px]"
                >
                  {copied ? "✓ コピー" : "コピー"}
                </button>
              </div>
            )}
            <p className="text-[12px] text-[#6E6E73] mt-2">
              ↑ このサービスアカウントのメールアドレスを下記5プロパティの「閲覧者」として追加してください。
            </p>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#FFF4E5] text-[#B25A00] border border-[#FFD599]">
            ⚠ Vercel環境変数 GOOGLE_SERVICE_ACCOUNT_JSON が未設定
          </span>
        )}
      </section>

      <section className="card mb-6">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">手順</h2>
        <ol className="space-y-4 text-[14px] text-[#1D1D1F]">
          <li className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[13px] font-semibold">1</span>
            <div>
              <p className="font-medium">Google Cloud Consoleで新規プロジェクト作成</p>
              <p className="text-[12px] text-[#6E6E73] mt-1">
                <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener" className="text-[#0071E3] hover:underline">console.cloud.google.com/projectcreate</a> で「spot-report-ga4」等の名前で作成
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[13px] font-semibold">2</span>
            <div>
              <p className="font-medium">Google Analytics Data API を有効化</p>
              <p className="text-[12px] text-[#6E6E73] mt-1">
                <a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noopener" className="text-[#0071E3] hover:underline">APIライブラリで「Google Analytics Data API」</a>を有効化
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[13px] font-semibold">3</span>
            <div>
              <p className="font-medium">サービスアカウント作成＆JSONキー発行</p>
              <p className="text-[12px] text-[#6E6E73] mt-1">
                IAM &amp; Admin &gt; <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener" className="text-[#0071E3] hover:underline">Service Accounts</a> → 「Create service account」→ 名前: spot-report-reader → 権限スキップで作成 → 作成したアカウント → 「KEYS」→「ADD KEY」→「Create new key」→ JSON選択してダウンロード
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[13px] font-semibold">4</span>
            <div>
              <p className="font-medium">VercelにJSON全文を環境変数として登録</p>
              <p className="text-[12px] text-[#6E6E73] mt-1">
                Vercel &gt; spot-report &gt; Settings &gt; Environment Variables で<br />
                Key: <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11px]">GOOGLE_SERVICE_ACCOUNT_JSON</code> / Value: ダウンロードしたJSON全文をそのまま貼付 / Production にチェック → Save → 再デプロイ
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[13px] font-semibold">5</span>
            <div>
              <p className="font-medium">GA4管理画面で サービスアカウントメールを「閲覧者」追加</p>
              <p className="text-[12px] text-[#6E6E73] mt-1">
                <a href="https://analytics.google.com" target="_blank" rel="noopener" className="text-[#0071E3] hover:underline">analytics.google.com</a> &gt; 管理 &gt; プロパティアクセス管理 &gt; 「+」ボタン &gt; メールアドレスに上記サービスアカウントemail &gt; 役割「閲覧者」 &gt; 保存。
                <span className="font-semibold text-[#B25A00]">下記5プロパティ全てに追加が必要です。</span>
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="card">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">対象GA4プロパティ（{status?.properties.length ?? 5}件）</h2>
        <div className="space-y-2">
          {(status?.properties ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#F0F0F0] last:border-0">
              <span className="font-mono text-[12px] text-[#6E6E73] w-28 shrink-0">{p.id}</span>
              <span className="text-[13px] text-[#1D1D1F] flex-1">{p.name}</span>
              {p.primary && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#E5F7EB] text-[#0F7B32]">PRIMARY</span>
              )}
              {p.siteUrl && (
                <a href={p.siteUrl} target="_blank" rel="noopener" className="text-[11px] text-[#0071E3] hover:underline">{p.siteUrl}</a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
