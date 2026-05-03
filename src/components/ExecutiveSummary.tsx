"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";

type TimelineDay = { date: string; clicks: number; conversions: number; cost: number };
type AdsData = {
  accountName: string;
  period: { from: string; to: string };
  days: number;
  totals: { cost: number; clicks: number; conversions: number; cpa: number; cpc: number };
  timeline: TimelineDay[];
  scrapedAt: string;
};
type IgData = {
  username: string;
  followers: number | null;
  postsCount: number | null;
  recentPosts: { url: string; caption: string }[];
  scrapedAt: string;
};
type Ga4Report = {
  totals: { activeUsers: number; pageViews: number; sessions: number };
  articleRanking: { path: string; title: string; views: number }[];
  period: { from: string; to: string };
};

function pctDelta(curr: number, prev: number): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (!prev) return { text: "—", tone: "neutral" };
  const d = ((curr - prev) / prev) * 100;
  const sign = d >= 0 ? "+" : "";
  return {
    text: `${sign}${d.toFixed(1)}% vs 前期`,
    tone: d > 1 ? "positive" : d < -1 ? "negative" : "neutral",
  };
}

function splitHalves<T>(arr: T[]): { prev: T[]; curr: T[] } {
  const mid = Math.floor(arr.length / 2);
  return { prev: arr.slice(0, mid), curr: arr.slice(mid) };
}

function sumField(rows: TimelineDay[], key: keyof TimelineDay): number {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

type ExecutiveSummaryProps = { range?: { from: string; to: string } };

export function ExecutiveSummary({ range }: ExecutiveSummaryProps = {}) {
  const [adsRaw, setAdsRaw] = useState<AdsData | null>(null);
  const [ig, setIg] = useState<IgData | null>(null);
  const [ga4, setGa4] = useState<Ga4Report | null>(null);

  useEffect(() => {
    fetch("/api/ads").then(r => r.json()).then(j => j.connected && setAdsRaw(j.data)).catch(() => {});
    fetch("/api/instagram").then(r => r.json()).then(j => j.connected && setIg(j.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (range?.from && range?.to) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    fetch(`/api/ga4${params.toString() ? "?" + params.toString() : ""}`)
      .then(r => r.json())
      .then(j => j.connected && setGa4(j.report))
      .catch(() => {});
  }, [range?.from, range?.to]);

  // Filter ads timeline to range and recompute totals (mirrors GoogleAdsView)
  const ads: AdsData | null = (() => {
    if (!adsRaw) return null;
    if (!range?.from || !range?.to) return adsRaw;
    const inRange = adsRaw.timeline.filter((d) => d.date >= range.from && d.date <= range.to);
    if (inRange.length === 0 || inRange.length === adsRaw.timeline.length) return adsRaw;
    const cost = inRange.reduce((s, d) => s + (d.cost || 0), 0);
    const clicks = inRange.reduce((s, d) => s + (d.clicks || 0), 0);
    const conversions = inRange.reduce((s, d) => s + ((d as TimelineDay).conversions || 0), 0);
    const cpa = conversions > 0 ? Math.round(cost / conversions) : 0;
    const cpc = clicks > 0 ? Math.round(cost / clicks) : 0;
    return {
      ...adsRaw,
      days: inRange.length,
      period: { from: range.from, to: range.to },
      timeline: inRange,
      totals: { ...adsRaw.totals, cost, clicks, conversions, cpa, cpc },
    };
  })();

  if (!ads && !ig && !ga4) {
    return <div className="card text-[#6E6E73] text-sm">読み込み中...</div>;
  }

  // Ads: split 30 days into first 15 vs last 15 as 前期比
  const adsSplit = ads ? splitHalves(ads.timeline) : null;
  const adsPrev = adsSplit ? { cost: sumField(adsSplit.prev, "cost"), clicks: sumField(adsSplit.prev, "clicks"), cv: sumField(adsSplit.prev, "conversions") } : null;
  const adsCurr = adsSplit ? { cost: sumField(adsSplit.curr, "cost"), clicks: sumField(adsSplit.curr, "clicks"), cv: sumField(adsSplit.curr, "conversions") } : null;
  const costDelta = adsPrev && adsCurr ? pctDelta(adsCurr.cost, adsPrev.cost) : null;
  const cvDelta = adsPrev && adsCurr ? pctDelta(adsCurr.cv, adsPrev.cv) : null;

  const newestScrape = [adsRaw?.scrapedAt, ig?.scrapedAt].filter(Boolean).sort().pop();
  const scrapedLabel = newestScrape ? new Date(newestScrape).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-8">
      <div className="card bg-gradient-to-br from-[#0071E3] to-[#0051A3] text-white border-0">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">今月のハイライト</h2>
            <p className="mt-1 text-[14px] text-white/80">
              {ads ? `${ads.period.from} 〜 ${ads.period.to}` : "過去30日間"} ・ 全チャネル横断 ・ 実データ
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-white/15 text-white border border-white/25">
            🕒 最終取得 {scrapedLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-[12px] text-white/70">広告費用（30日）</p>
            <p className="text-[28px] font-semibold tabular-nums">{ads ? fmt.yen(ads.totals.cost) : "—"}</p>
            {costDelta && <p className={`text-[12px] mt-0.5 ${costDelta.tone === "positive" ? "text-[#A8E5BD]" : costDelta.tone === "negative" ? "text-[#FFB4A8]" : "text-white/70"}`}>{costDelta.text}</p>}
          </div>
          <div>
            <p className="text-[12px] text-white/70">広告CV</p>
            <p className="text-[28px] font-semibold tabular-nums">{ads ? ads.totals.conversions.toFixed(0) : "—"}</p>
            {cvDelta && <p className={`text-[12px] mt-0.5 ${cvDelta.tone === "positive" ? "text-[#A8E5BD]" : cvDelta.tone === "negative" ? "text-[#FFB4A8]" : "text-white/70"}`}>{cvDelta.text} / CPA {ads ? fmt.yen(ads.totals.cpa) : "—"}</p>}
          </div>
          <div>
            <p className="text-[12px] text-white/70">Instagramフォロワー</p>
            <p className="text-[28px] font-semibold tabular-nums">{ig?.followers !== null && ig?.followers !== undefined ? fmt.num(ig.followers) : "—"}</p>
            <p className="text-[12px] text-white/70 mt-0.5">@{ig?.username ?? "—"} ・ 投稿{ig?.postsCount ?? "—"}件</p>
          </div>
          <div>
            <p className="text-[12px] text-white/70">サイト利用者</p>
            <p className="text-[28px] font-semibold tabular-nums">{ga4 ? fmt.num(ga4.totals.activeUsers) : "—"}</p>
            <p className="text-[12px] text-white/70 mt-0.5">{ga4 ? `${fmt.num(ga4.totals.pageViews)} PV` : "GA4接続確認中"}</p>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="3つの主要チャネル" sub="タブ切替で詳細を確認" />
        <div className="grid md:grid-cols-3 gap-4">
          <MetricCard
            label="Google広告 費用"
            value={ads ? fmt.yen(ads.totals.cost) : "—"}
            delta={costDelta?.text}
            deltaTone={costDelta?.tone}
            sub={ads ? `${fmt.num(ads.totals.clicks)}クリック・CPA ${fmt.yen(ads.totals.cpa)}` : undefined}
          />
          <MetricCard
            label="サイトアクセス"
            value={ga4 ? fmt.num(ga4.totals.pageViews) : "—"}
            sub={ga4 ? `${fmt.num(ga4.totals.activeUsers)}人・${ga4.articleRanking?.length ?? 0}ページ計測中` : "接続確認中"}
          />
          <MetricCard
            label="Instagramフォロワー"
            value={ig?.followers !== null && ig?.followers !== undefined ? fmt.num(ig.followers) : "—"}
            sub={ig ? `@${ig.username}・投稿${ig.postsCount ?? "—"}件` : undefined}
          />
        </div>
      </div>

      {ga4 && ga4.articleRanking && ga4.articleRanking.length > 0 && (
        <div className="card">
          <SectionHeader title="反響TOP3記事" sub="サイト内のPV上位" />
          <div className="space-y-3">
            {ga4.articleRanking.slice(0, 3).map((a, i) => (
              <div key={a.path} className="flex items-center gap-4 py-3 border-b border-[#F0F0F0] last:border-0">
                <div className="w-10 h-10 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-lg font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1D1D1F] truncate">{a.title || a.path}</p>
                  <a href={`https://spot-s.or.jp${a.path}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0071E3] hover:underline font-mono">
                    spot-s.or.jp{a.path}
                  </a>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[20px] font-semibold tabular-nums text-[#1D1D1F]">{fmt.num(a.views)}</p>
                  <p className="text-xs text-[#6E6E73]">PV</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
