"use client";
import { googleAdsOverview, ga4Overview, instagramOverview } from "@/lib/mock-data";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";

export function ExecutiveSummary() {
  const ga = googleAdsOverview;
  const g4 = ga4Overview;
  const ig = instagramOverview;
  const top3 = g4.articleRanking.slice(0, 3);
  return (
    <div className="space-y-8">
      <div className="card bg-gradient-to-br from-[#0071E3] to-[#0051A3] text-white border-0">
        <h2 className="text-[24px] font-semibold tracking-tight">今月のハイライト</h2>
        <p className="mt-1 text-[14px] text-white/80">{ga.period.from} 〜 {ga.period.to} の主要指標・全チャネル横断</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-[12px] text-white/70">Web流入</p>
            <p className="text-[28px] font-semibold tabular-nums">{fmt.num(g4.totals.activeUsers)}</p>
            <p className="text-[12px] text-[#A8E5BD] mt-0.5">+22.7% vs 前月</p>
          </div>
          <div>
            <p className="text-[12px] text-white/70">広告CV</p>
            <p className="text-[28px] font-semibold tabular-nums">{fmt.num(ga.totals.conversions)}</p>
            <p className="text-[12px] text-[#A8E5BD] mt-0.5">+16.7% / CPA {fmt.yen(ga.totals.cpa)}</p>
          </div>
          <div>
            <p className="text-[12px] text-white/70">Instagram リーチ</p>
            <p className="text-[28px] font-semibold tabular-nums">{fmt.num(ig.totals.reach)}</p>
            <p className="text-[12px] text-[#A8E5BD] mt-0.5">+14.8% vs 前月</p>
          </div>
          <div>
            <p className="text-[12px] text-white/70">記事PV</p>
            <p className="text-[28px] font-semibold tabular-nums">{fmt.num(g4.totals.pageViews)}</p>
            <p className="text-[12px] text-[#A8E5BD] mt-0.5">+18.2% vs 前月</p>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="3つの主要チャネル" sub="クリックで詳細タブへ" />
        <div className="grid md:grid-cols-3 gap-4">
          <MetricCard label="Google広告 費用" value={fmt.yen(ga.totals.cost)} delta="+4.2%" deltaTone="neutral" sub={`${fmt.num(ga.totals.clicks)}クリック`} />
          <MetricCard label="GA4 記事PV" value={fmt.num(g4.totals.pageViews)} delta="+18.2%" deltaTone="positive" sub={`${g4.articleRanking.length}記事計測中`} />
          <MetricCard label="Instagram フォロワー" value={fmt.num(ig.followers)} delta="+32" deltaTone="positive" sub="過去30日" />
        </div>
      </div>

      <div className="card">
        <SectionHeader title="反響TOP3記事（お役立ち情報）" />
        <div className="space-y-3">
          {top3.map((a, i) => (
            <div key={a.path} className="flex items-center gap-4 py-3 border-b border-[#F0F0F0] last:border-0">
              <div className="w-10 h-10 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-lg font-bold">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1D1D1F] truncate">{a.title}</p>
                <a href={`https://spot-s.or.jp${a.path}`} target="_blank" rel="noopener" className="text-xs text-[#0071E3] hover:underline font-mono">spot-s.or.jp{a.path}</a>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[20px] font-semibold tabular-nums text-[#1D1D1F]">{fmt.num(a.views)}</p>
                <p className="text-xs text-[#6E6E73]">PV</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
