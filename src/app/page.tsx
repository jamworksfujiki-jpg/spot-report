"use client";
import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { GoogleAdsView } from "@/components/GoogleAdsView";
import { Ga4View } from "@/components/Ga4View";
import { InstagramView } from "@/components/InstagramView";
import { DateRangePicker, lastNDaysRange, type DateRange } from "@/components/DateRangePicker";

const TABS = [
  { id: "summary", label: "サマリー", icon: "📊" },
  { id: "ads", label: "Google広告", icon: "🎯" },
  { id: "ga4", label: "記事アクセス", icon: "📖" },
  { id: "instagram", label: "Instagram", icon: "📸" },
];

export default function Home() {
  const [active, setActive] = useState("summary");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<DateRange>(() => lastNDaysRange(30));
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  async function refresh() {
    setRefreshing(true);
    // Pre-warm all APIs with cache-busting so Next.js server returns fresh JSON to the remounted children
    try {
      const bust = `?t=${Date.now()}`;
      await Promise.all([
        fetch(`/api/ads${bust}`, { cache: "no-store" }),
        fetch(`/api/ga4${bust}`, { cache: "no-store" }),
        fetch(`/api/instagram${bust}`, { cache: "no-store" }),
      ]);
    } catch {
      /* ignore */
    }
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#1D1D1F]">スポット社労士くん 統合レポート</h1>
            <p className="mt-1 text-[14px] text-[#6E6E73]">Google広告 / GA4 / Instagram ・ {today}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium rounded-full bg-white border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F5F5F7] min-h-[44px]"
            >
              📥 PDFでダウンロード
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-4 py-2 text-sm font-medium rounded-full bg-[#0071E3] text-white hover:bg-[#0051A3] min-h-[44px] disabled:opacity-60 disabled:cursor-wait"
            >
              {refreshing ? "🔄 更新中…" : "🔄 最新データ取得"}
            </button>
          </div>
        </div>
        <div className="mt-6">
          <Tabs tabs={TABS} active={active} onChange={setActive} />
        </div>
        <div className="mt-4">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      <main key={refreshKey}>
        {active === "summary" && <ExecutiveSummary range={range} />}
        {active === "ads" && <GoogleAdsView range={range} />}
        {active === "ga4" && <Ga4View range={range} />}
        {active === "instagram" && <InstagramView />}
      </main>

      <footer className="mt-16 pt-8 border-t border-[#D2D2D7] text-center text-xs text-[#6E6E73]">
        <p>Google広告・GA4・Instagramすべて実データ / 毎朝07:00にWindowsタスクスケジューラで自動更新</p>
      </footer>
    </div>
  );
}
