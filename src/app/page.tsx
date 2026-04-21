"use client";
import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { GoogleAdsView } from "@/components/GoogleAdsView";
import { Ga4View } from "@/components/Ga4View";
import { InstagramView } from "@/components/InstagramView";

const TABS = [
  { id: "summary", label: "サマリー", icon: "📊" },
  { id: "ads", label: "Google広告", icon: "🎯" },
  { id: "ga4", label: "記事アクセス", icon: "📖" },
  { id: "instagram", label: "Instagram", icon: "📸" },
];

export default function Home() {
  const [active, setActive] = useState("summary");
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#1D1D1F]">スポット社労士くん 統合レポート</h1>
            <p className="mt-1 text-[14px] text-[#6E6E73]">Google広告 / GA4 / Instagram ・ {today}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium rounded-full bg-white border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F5F5F7] min-h-[44px]">
              📥 PDFでダウンロード
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-full bg-[#0071E3] text-white hover:bg-[#0051A3] min-h-[44px]">
              🔄 最新データ取得
            </button>
          </div>
        </div>
        <div className="mt-6">
          <Tabs tabs={TABS} active={active} onChange={setActive} />
        </div>
      </header>

      <main>
        {active === "summary" && <ExecutiveSummary />}
        {active === "ads" && <GoogleAdsView />}
        {active === "ga4" && <Ga4View />}
        {active === "instagram" && <InstagramView />}
      </main>

      <footer className="mt-16 pt-8 border-t border-[#D2D2D7] text-center text-xs text-[#6E6E73]">
        <p>※ 一部データはAPI接続準備中のためモック表示中 / GA4 Data API OAuth認証後にライブ接続されます</p>
      </footer>
    </div>
  );
}
