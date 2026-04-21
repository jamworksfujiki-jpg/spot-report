"use client";
import { googleAdsOverview as d } from "@/lib/mock-data";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from "recharts";

export function GoogleAdsView() {
  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <SectionHeader
            title="Google広告 サマリー"
            sub={`${d.accountName}（${d.customerId}）・${d.period.from} 〜 ${d.period.to}`}
          />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#FFF4E5] text-[#B25A00] border border-[#FFD599]">
          ⚠ API接続準備中（MCC申請中・1-2週間）
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="表示回数" value={fmt.num(d.totals.impressions)} delta="+12.4%" deltaTone="positive" sub="前期比" />
        <MetricCard label="クリック数" value={fmt.num(d.totals.clicks)} delta="+8.1%" deltaTone="positive" sub="前期比" />
        <MetricCard label="コンバージョン" value={fmt.num(d.totals.conversions)} delta="+16.7%" deltaTone="positive" sub="前期比" />
        <MetricCard label="費用" value={fmt.yen(d.totals.cost)} delta="+4.2%" deltaTone="neutral" sub="前期比" />
        <MetricCard label="CTR" value={fmt.pct(d.totals.ctr, 2)} delta="+0.18pt" deltaTone="positive" />
        <MetricCard label="CPA" value={fmt.yen(d.totals.cpa)} delta="-10.7%" deltaTone="positive" sub="前期比" />
      </div>

      <div className="card">
        <SectionHeader title="日次トレンド" sub="表示回数・クリック数・費用の推移" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tickFormatter={fmt.shortDate} stroke="#6E6E73" fontSize={11} />
              <YAxis stroke="#6E6E73" fontSize={11} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }}
                labelFormatter={(l: unknown) => fmt.shortDate(String(l))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="impressions" stroke="#0071E3" strokeWidth={2} name="表示回数" dot={false} />
              <Line type="monotone" dataKey="clicks" stroke="#30D158" strokeWidth={2} name="クリック" dot={false} />
              <Line type="monotone" dataKey="conversions" stroke="#FF9F0A" strokeWidth={2} name="CV" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="キャンペーン別パフォーマンス" />
        <div className="h-72 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.campaigns} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis type="number" stroke="#6E6E73" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#6E6E73" fontSize={11} width={180} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="clicks" fill="#0071E3" name="クリック" radius={[0, 6, 6, 0]} />
              <Bar dataKey="conversions" fill="#30D158" name="CV" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                <th className="py-3 font-medium">キャンペーン</th>
                <th className="py-3 font-medium">ステータス</th>
                <th className="py-3 font-medium text-right">表示</th>
                <th className="py-3 font-medium text-right">クリック</th>
                <th className="py-3 font-medium text-right">費用</th>
                <th className="py-3 font-medium text-right">CV</th>
                <th className="py-3 font-medium text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {d.campaigns.map((c) => (
                <tr key={c.name} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
                  <td className="py-3 font-medium text-[#1D1D1F]">{c.name}</td>
                  <td className="py-3 text-[#6E6E73]">{c.status}</td>
                  <td className="py-3 text-right tabular-nums">{fmt.num(c.impressions)}</td>
                  <td className="py-3 text-right tabular-nums">{fmt.num(c.clicks)}</td>
                  <td className="py-3 text-right tabular-nums">{fmt.yen(c.cost)}</td>
                  <td className="py-3 text-right tabular-nums">{c.conversions}</td>
                  <td className="py-3 text-right tabular-nums font-semibold">{fmt.yen(c.cpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
