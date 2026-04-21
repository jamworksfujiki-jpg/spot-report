"use client";
import { instagramOverview as d } from "@/lib/mock-data";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = ["#FF375F", "#0071E3", "#BF5AF2", "#30D158", "#FF9F0A", "#64D2FF"];

export function InstagramView() {
  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <SectionHeader
          title={`Instagram @${d.username}`}
          sub={`${d.displayName}・${d.period.from} 〜 ${d.period.to}`}
        />
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#FFF4E5] text-[#B25A00] border border-[#FFD599]">
          ⚠ Graph API接続準備中
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="フォロワー" value={fmt.num(d.followers)} delta="+32" deltaTone="positive" sub="過去30日" />
        <MetricCard label="リーチ" value={fmt.num(d.totals.reach)} delta="+14.8%" deltaTone="positive" />
        <MetricCard label="インプレッション" value={fmt.num(d.totals.impressions)} delta="+18.2%" deltaTone="positive" />
        <MetricCard label="プロフィール訪問" value={fmt.num(d.totals.profileVisits)} delta="+22.1%" deltaTone="positive" />
        <MetricCard label="サイト誘導" value={fmt.num(d.totals.websiteClicks)} delta="+11.4%" deltaTone="positive" />
        <MetricCard label="エンゲージ率" value={fmt.pct(d.totals.engagementRate)} delta="+0.6pt" deltaTone="positive" />
      </div>

      <div className="card">
        <SectionHeader title="日次トレンド" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tickFormatter={fmt.shortDate} stroke="#6E6E73" fontSize={11} />
              <YAxis stroke="#6E6E73" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} labelFormatter={(l: unknown) => fmt.shortDate(String(l))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="reach" stroke="#FF375F" strokeWidth={2} name="リーチ" dot={false} />
              <Line type="monotone" dataKey="impressions" stroke="#0071E3" strokeWidth={2} name="インプレッション" dot={false} />
              <Line type="monotone" dataKey="engagements" stroke="#30D158" strokeWidth={2} name="エンゲージメント" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <SectionHeader title="年代別オーディエンス" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.demographics.age}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="bucket" stroke="#6E6E73" fontSize={11} />
                <YAxis stroke="#6E6E73" fontSize={11} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                <Bar dataKey="share" fill="#FF375F" radius={[6, 6, 0, 0]} name="構成比" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="性別比率" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.demographics.gender} dataKey="share" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.type} ${e.share.toFixed(1)}%`}>
                  {d.demographics.gender.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <SectionHeader title="主要都市" sub="フォロワー居住地TOP6" />
          <div className="space-y-2">
            {d.demographics.topCities.map((c) => (
              <div key={c.city} className="flex items-center gap-3">
                <span className="text-sm font-medium w-16 text-[#1D1D1F]">{c.city}</span>
                <div className="flex-1 h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF375F]" style={{ width: `${c.share * 3}%` }} />
                </div>
                <span className="text-sm tabular-nums font-semibold w-12 text-right">{fmt.pct(c.share)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <SectionHeader title="投稿ランキング（反響順）" />
          <div className="space-y-3">
            {d.topPosts.map((p, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-[#F0F0F0] last:border-0">
                <span className="text-[#6E6E73] font-semibold w-6 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1D1D1F] truncate">{p.caption}</p>
                  <div className="flex items-center gap-3 text-xs text-[#6E6E73] mt-1">
                    <span>❤ {p.likes}</span>
                    <span>💬 {p.comments}</span>
                    <span>🔖 {p.saves}</span>
                    <span>👁 {fmt.num(p.reach)}</span>
                    <span className="ml-auto font-semibold text-[#30D158]">{fmt.pct(p.engagementRate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
