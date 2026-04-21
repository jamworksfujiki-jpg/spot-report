"use client";
import { useEffect, useState } from "react";
import { ga4Overview as mock, ga4Properties as mockProps } from "@/lib/mock-data";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["#0071E3", "#30D158", "#FF9F0A", "#BF5AF2", "#FF375F", "#64D2FF"];

type Ga4Data = {
  period: { from: string; to: string };
  totals: {
    pageViews: number;
    activeUsers: number;
    newUsers: number;
    sessions: number;
    avgEngagementSec: number;
    bounceRate: number;
  };
  timeline: { date: string; pageViews: number; users: number; sessions: number }[];
  articleRanking: { path: string; title: string; views: number; avgTimeSec: number; bounceRate: number }[];
  trafficSources: { source: string; users: number; share: number }[];
  transitions: { from: string; to: string; count: number; share: number }[];
  live: boolean;
};

export function Ga4View() {
  const [propertyId, setPropertyId] = useState(mockProps[0].id);
  const [data, setData] = useState<Ga4Data>({ ...mock, live: false });
  const [loading, setLoading] = useState(false);
  const [connectionMsg, setConnectionMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setConnectionMsg(null);
    fetch(`/api/ga4?propertyId=${propertyId}&days=28`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.connected && res.report) {
          setData({ ...res.report, live: true });
        } else {
          setData({ ...mock, live: false });
          setConnectionMsg(res.message ?? res.error ?? "GA4 Data API 未接続");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setData({ ...mock, live: false });
        setConnectionMsg(e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const d = data;
  const isLive = d.live;
  const selected = mockProps.find((p) => p.id === propertyId) ?? mockProps[0];

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <SectionHeader
          title="お役立ち情報 記事アクセス"
          sub={`${selected.siteUrl || selected.name} / ${d.period.from} 〜 ${d.period.to}`}
        />
        <div className="flex items-center gap-2">
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="px-3 py-1.5 text-[12px] rounded-full bg-white border border-[#D2D2D7] text-[#1D1D1F] min-h-[36px]"
          >
            {mockProps.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#E5F7EB] text-[#0F7B32] border border-[#A8E5BD]">
              ✓ GA4 Data API ライブ接続中
            </span>
          ) : (
            <a
              href="/setup"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#FFF4E5] text-[#B25A00] border border-[#FFD599] hover:bg-[#FFE7C2]"
            >
              ⚠ GA4接続準備中（セットアップ）
            </a>
          )}
        </div>
      </div>

      {connectionMsg && !isLive && (
        <div className="text-[12px] text-[#6E6E73] bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl px-4 py-2">
          {loading ? "取得中..." : `モック表示中: ${connectionMsg}`}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="ページビュー" value={fmt.num(d.totals.pageViews)} delta={isLive ? undefined : "+18.2%"} deltaTone="positive" />
        <MetricCard label="アクティブユーザー" value={fmt.num(d.totals.activeUsers)} delta={isLive ? undefined : "+22.7%"} deltaTone="positive" />
        <MetricCard label="新規ユーザー" value={fmt.num(d.totals.newUsers)} delta={isLive ? undefined : "+24.1%"} deltaTone="positive" />
        <MetricCard label="セッション" value={fmt.num(d.totals.sessions)} delta={isLive ? undefined : "+19.8%"} deltaTone="positive" />
        <MetricCard label="平均滞在時間" value={`${Math.floor(d.totals.avgEngagementSec / 60)}m${d.totals.avgEngagementSec % 60}s`} delta={isLive ? undefined : "+8s"} deltaTone="positive" />
        <MetricCard label="直帰率" value={fmt.pct(d.totals.bounceRate)} delta={isLive ? undefined : "-2.4pt"} deltaTone="positive" />
      </div>

      <div className="card">
        <SectionHeader title="日次PV・UU推移" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tickFormatter={fmt.shortDate} stroke="#6E6E73" fontSize={11} />
              <YAxis stroke="#6E6E73" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} labelFormatter={(l: unknown) => fmt.shortDate(String(l))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="pageViews" stroke="#0071E3" strokeWidth={2} name="PV" dot={false} />
              <Line type="monotone" dataKey="users" stroke="#30D158" strokeWidth={2} name="UU" dot={false} />
              <Line type="monotone" dataKey="sessions" stroke="#FF9F0A" strokeWidth={2} name="セッション" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <SectionHeader title="流入元内訳" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.trafficSources} dataKey="users" nameKey="source" cx="50%" cy="50%" outerRadius={90} labelLine={false}>
                  {d.trafficSources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="主要な記事遷移（From → To）" sub={isLive && d.transitions.length === 0 ? "遷移データは現在未取得（次ページ分析は今後対応）" : undefined} />
          <div className="space-y-2">
            {d.transitions.length === 0 && (
              <p className="text-[12px] text-[#6E6E73] py-4 text-center">データなし</p>
            )}
            {d.transitions.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F0F0F0] last:border-0">
                <span className="font-mono text-xs text-[#6E6E73] w-20 shrink-0">{t.from}</span>
                <span className="text-[#6E6E73]">→</span>
                <span className="font-mono text-xs text-[#0071E3] flex-1">{t.to}</span>
                <span className="text-xs tabular-nums text-[#6E6E73]">{fmt.num(t.count)}件</span>
                <span className="text-xs tabular-nums font-semibold text-[#1D1D1F] w-12 text-right">{fmt.pct(t.share)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="お役立ち情報 記事ランキング（反響順）" sub="ページビュー数・平均滞在時間・直帰率" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                <th className="py-3 font-medium w-12">#</th>
                <th className="py-3 font-medium">記事タイトル</th>
                <th className="py-3 font-medium w-20">URL</th>
                <th className="py-3 font-medium text-right w-20">PV</th>
                <th className="py-3 font-medium text-right w-24">滞在</th>
                <th className="py-3 font-medium text-right w-20">直帰率</th>
              </tr>
            </thead>
            <tbody>
              {d.articleRanking.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-[#6E6E73]">データなし</td></tr>
              )}
              {d.articleRanking.map((a, i) => (
                <tr key={`${a.path}-${i}`} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
                  <td className="py-3 text-[#6E6E73] font-semibold">{i + 1}</td>
                  <td className="py-3 text-[#1D1D1F]"><span className="font-medium">{a.title}</span></td>
                  <td className="py-3 font-mono text-xs">
                    <a href={`${selected.siteUrl || "https://spot-s.or.jp"}${a.path}`} target="_blank" rel="noopener" className="text-[#0071E3] hover:underline">{a.path}</a>
                  </td>
                  <td className="py-3 text-right tabular-nums font-semibold">{fmt.num(a.views)}</td>
                  <td className="py-3 text-right tabular-nums text-[#6E6E73]">{Math.floor(a.avgTimeSec / 60)}m{a.avgTimeSec % 60}s</td>
                  <td className="py-3 text-right tabular-nums text-[#6E6E73]">{fmt.pct(a.bounceRate, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
