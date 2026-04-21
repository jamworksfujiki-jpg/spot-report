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
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    fetch("/api/ga4/status").then((r) => r.json()).then(setStatus);
  }, []);

  const email = status?.serviceAccountEmail;
  const configured = status?.configured ?? false;

  const copy = (v: string, setFn: (b: boolean) => void) => {
    navigator.clipboard.writeText(v).then(() => {
      setFn(true);
      setTimeout(() => setFn(false), 1500);
    });
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <header className="mb-8">
        <a href="/" className="text-[13px] text-[#0071E3] hover:underline">← ダッシュボードに戻る</a>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-[#1D1D1F]">GA4 ライブ接続セットアップ</h1>
        <p className="mt-1 text-[14px] text-[#6E6E73]">記事アクセスのリアルデータを表示するための初回設定（合計5〜10分）</p>
      </header>

      {/* Progress banner */}
      <section className={`card mb-6 ${configured ? "bg-[#E5F7EB]" : "bg-[#FFF8E5]"} border-2 ${configured ? "border-[#A8E5BD]" : "border-[#FFD599]"}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${configured ? "bg-[#30D158] text-white" : "bg-[#FF9F0A] text-white"}`}>
            {configured ? "✓" : "!"}
          </div>
          <div className="flex-1">
            {!status ? (
              <p className="text-[14px] text-[#6E6E73]">読み込み中...</p>
            ) : configured ? (
              <>
                <p className="text-[15px] font-semibold text-[#0F7B32]">Vercelに設定済み</p>
                <p className="text-[12px] text-[#1D1D1F] mt-0.5">あとは <b>ステップ5</b>（GA4プロパティへの閲覧者追加）だけです</p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[#B25A00]">未接続（現在モック表示中）</p>
                <p className="text-[12px] text-[#1D1D1F] mt-0.5">下記5ステップを順にやるだけ。所要5〜10分</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Step 1 */}
      <StepCard
        num={1}
        title="Google Cloud に新規プロジェクト作成"
        time="1分"
        action={{ url: "https://console.cloud.google.com/projectcreate", label: "Google Cloudを開く" }}
      >
        <ol className="text-[13px] text-[#1D1D1F] space-y-1.5 list-decimal list-inside">
          <li>プロジェクト名に <Code>spot-report-ga4</Code> と入力（組織や場所は初期値のままでOK）</li>
          <li>右下の <b>「作成」</b> を押して完了</li>
        </ol>
      </StepCard>

      {/* Step 2 */}
      <StepCard
        num={2}
        title="Analytics Data API を有効化"
        time="30秒"
        action={{ url: "https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com", label: "API有効化画面を開く" }}
      >
        <ol className="text-[13px] text-[#1D1D1F] space-y-1.5 list-decimal list-inside">
          <li>上のリンクを開く</li>
          <li>画面上部のプロジェクト選択で <Code>spot-report-ga4</Code> を選択</li>
          <li>青いボタン <b>「有効にする」</b> を押す（数秒で切替わります）</li>
        </ol>
      </StepCard>

      {/* Step 3 */}
      <StepCard
        num={3}
        title="サービスアカウント作成＆JSONキー発行"
        time="2分"
        action={{ url: "https://console.cloud.google.com/iam-admin/serviceaccounts", label: "サービスアカウント画面を開く" }}
      >
        <ol className="text-[13px] text-[#1D1D1F] space-y-2 list-decimal list-inside">
          <li>画面上部のプロジェクト選択で <Code>spot-report-ga4</Code> を選択</li>
          <li>上部 <b>「＋ サービスアカウントを作成」</b> を押す</li>
          <li>
            名前に <Code>spot-report-reader</Code> を入力 → <b>「作成して続行」</b>
            <p className="text-[11px] text-[#6E6E73] mt-0.5 ml-5">※ 「ロール選択」と「アクセス権付与」のステップは<b>スキップ</b>でOK（最下部の「完了」を押す）</p>
          </li>
          <li>
            一覧に表示された <Code>spot-report-reader@...</Code> を<b>クリック</b>
          </li>
          <li>上部タブの <b>「キー」</b> を選択 → <b>「鍵を追加」</b> → <b>「新しい鍵を作成」</b></li>
          <li><b>「JSON」</b>を選んで <b>「作成」</b> を押す → PCに <Code>xxx.json</Code> がダウンロードされる</li>
        </ol>
        <div className="mt-3 px-3 py-2 bg-[#FFF4E5] border border-[#FFD599] rounded-lg text-[12px] text-[#1D1D1F]">
          💡 このJSONファイルは次のステップで使います。テキストエディタで開けるようにしておいてください。
        </div>
      </StepCard>

      {/* Step 4 */}
      <StepCard
        num={4}
        title="Vercelの環境変数に JSON全文を貼り付け"
        time="1分"
        action={{ url: "https://vercel.com/e-gov-spotportal/spot-report/settings/environment-variables", label: "Vercel設定を開く" }}
      >
        <ol className="text-[13px] text-[#1D1D1F] space-y-2 list-decimal list-inside">
          <li>上のリンクを開く（spot-report の Environment Variables 画面）</li>
          <li>
            <b>Key</b> に <KeyCopy value="GOOGLE_SERVICE_ACCOUNT_JSON" label="キー名をコピー" /> を入力
          </li>
          <li>
            <b>Value</b> に、ステップ3でダウンロードしたJSONファイルを<b>テキストエディタで開いて全文コピー</b>して貼り付け
            <p className="text-[11px] text-[#6E6E73] mt-0.5 ml-5">※ <Code>{"{"}</Code> から <Code>{"}"}</Code> まで、改行も含めてそのまま全部貼り付けでOK</p>
          </li>
          <li>Environment: <b>Production / Preview / Development 3つともチェック</b></li>
          <li><b>「Save」</b>を押す</li>
          <li>
            保存後、このページを教えてください。Claude側で<b>再デプロイ</b>します。
            <p className="text-[11px] text-[#6E6E73] mt-0.5 ml-5">（or Vercel画面で Deployments &gt; 最新 &gt; 「Redeploy」 &gt; 「Use existing Build Cache」OFF で再デプロイ）</p>
          </li>
        </ol>
      </StepCard>

      {/* Step 5 */}
      <StepCard
        num={5}
        title="GA4 の5プロパティに サービスアカウントemail を追加"
        time="3分"
        action={{ url: "https://analytics.google.com", label: "Google Analyticsを開く" }}
      >
        <div className="mb-3">
          <p className="text-[13px] text-[#1D1D1F] mb-2">使うメールアドレス（ステップ4でVercelに設定後、ここに自動表示されます）:</p>
          {email ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-[#F5F5F7] rounded-lg text-[13px] font-mono text-[#1D1D1F] break-all">{email}</code>
              <button
                onClick={() => copy(email, setCopiedEmail)}
                className="shrink-0 px-4 py-2.5 text-[12px] font-semibold rounded-lg bg-[#0071E3] text-white hover:bg-[#0051A3] min-h-[44px]"
              >
                {copiedEmail ? "✓ コピー済" : "📋 コピー"}
              </button>
            </div>
          ) : (
            <div className="px-3 py-2.5 bg-[#FFF4E5] border border-[#FFD599] rounded-lg text-[12px] text-[#B25A00]">
              ⚠ ステップ4を完了すると、ここに <Code>spot-report-reader@spot-report-ga4.iam.gserviceaccount.com</Code> のようなメールが自動表示されます
            </div>
          )}
        </div>

        <div className="px-3 py-2 bg-[#F5F5F7] rounded-lg mb-3">
          <p className="text-[12px] font-semibold text-[#1D1D1F]">📋 GA4での操作手順（1プロパティごとに）:</p>
          <ol className="text-[12px] text-[#1D1D1F] space-y-1 list-decimal list-inside mt-1.5">
            <li>右上のアカウント切替で該当プロパティを選択</li>
            <li>左下の<b>歯車アイコン（管理）</b>をクリック</li>
            <li>プロパティ列の<b>「プロパティのアクセス管理」</b>をクリック</li>
            <li>右上の <b>「+」→「ユーザーを追加」</b></li>
            <li>メールアドレス欄にコピーしたメールを貼付 → 役割 <b>「閲覧者」</b>選択 → <b>「追加」</b></li>
          </ol>
        </div>

        <p className="text-[12px] font-semibold text-[#B25A00] mb-2">⚠ 下記5プロパティ<b>全て</b>に同じメールを追加してください:</p>
        <div className="space-y-1.5">
          {(status?.properties ?? []).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[#FAFAFA] rounded-lg border border-[#F0F0F0]">
              <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
              <span className="font-mono text-[11px] text-[#6E6E73] w-24 shrink-0">{p.id}</span>
              <span className="text-[12px] text-[#1D1D1F] flex-1">{p.name}</span>
              {p.primary && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#0071E3] text-white">最重要</span>
              )}
            </div>
          ))}
        </div>
      </StepCard>

      {/* Done */}
      <section className="card mt-6 bg-gradient-to-br from-[#E0F1FF] to-[#EEF8FF] border-2 border-[#A8D4F5]">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-2">🎉 ステップ5まで終わったら</h2>
        <p className="text-[13px] text-[#1D1D1F]">
          <a href="/" className="text-[#0071E3] font-semibold hover:underline">ダッシュボード</a>の<b>「記事アクセス」</b>タブを開くと、バッジが <span className="px-2 py-0.5 bg-[#E5F7EB] text-[#0F7B32] rounded-full text-[11px] font-semibold">✓ GA4 Data API ライブ接続中</span> に変わり、リアルデータが表示されます。
        </p>
        <p className="text-[12px] text-[#6E6E73] mt-2">
          ※ 反映されない場合はVercelで「Redeploy」を実行してください（環境変数変更後は再デプロイが必要）
        </p>
      </section>
    </div>
  );
}

function StepCard({
  num, title, time, action, children,
}: {
  num: number;
  title: string;
  time: string;
  action?: { url: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-4">
      <div className="flex items-start gap-4 mb-4">
        <div className="shrink-0 w-10 h-10 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[16px] font-semibold">
          {num}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 className="text-[18px] font-semibold text-[#1D1D1F]">{title}</h2>
            <span className="text-[11px] text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-full">⏱ {time}</span>
          </div>
          {action && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 text-[13px] font-semibold rounded-full bg-[#1D1D1F] text-white hover:bg-[#000] min-h-[40px]"
            >
              {action.label} →
            </a>
          )}
        </div>
      </div>
      <div className="ml-14">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11.5px] font-mono text-[#1D1D1F]">{children}</code>;
}

function KeyCopy({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11.5px] font-mono text-[#1D1D1F]">{value}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="text-[10px] px-1.5 py-0.5 rounded bg-[#0071E3] text-white hover:bg-[#0051A3]"
        aria-label={label}
      >
        {copied ? "✓" : "📋"}
      </button>
    </span>
  );
}
