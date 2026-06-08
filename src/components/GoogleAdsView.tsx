"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from "recharts";

type Campaign = { name: string; group: string; status: string; cost: number; conversions: number; cpa: number };
type TimelineDay = { date: string; clicks: number; conversionsPrimary?: number; conversionsSecondary?: number; conversions?: number; cost: number };
type Device = { device: string; cost: number; clicks: number; conversions: number };
type SearchTerm = { term: string; cost: number; clicks: number; impressions: number; conversions: number };
type BiddedKeyword = { keyword: string; matchType: string; status: string; cost: number; clicks: number; ctr: number };
type NetworkRow = { name: string; clicks: number; cost: number; cpc: number };
type DemoRow = { label: string; impressions: number; share: number };
type SearchTermCv = { term: string; campaign?: string; cost: number; clicks: number; impressions: number; conversions: number };
type CvAction = { name: string; category: string; source: string; allConversions: number; primaryConversions: number; value: number };
type AdsData = {
  customerId: string;
  accountName: string;
  period: { from: string; to: string };
  days: number;
  totals: {
    cost: number;
    clicks: number;
    conversions: number;
    searchImpressions: number;
    searchClicks: number;
    cpc: number;
    cpa: number;
    searchCtr: number;
  };
  campaigns: Campaign[];
  timeline: TimelineDay[];
  devices: Device[];
  searchTerms: SearchTerm[];
  biddedKeywords?: BiddedKeyword[];
  network?: NetworkRow[];
  gender?: DemoRow[];
  age?: DemoRow[];
  consistency?: { clicksMatch: boolean; costMatch: boolean };
  source: string;
  scrapedAt: string;
  searchTermsCv?: { items: SearchTermCv[]; withCv: number; totalCv: number; scrapedAt: string } | null;
  cvActions?: {
    period: string;
    total: number;
    totalAllConversions: number;
    totalPrimaryConversions: number;
    items: CvAction[];
    scrapedAt: string;
  } | null;
};

type GoogleAdsViewProps = { range?: { from: string; to: string } };

const isThanksAction = (name: string) => /サンクス|thanks|完了|送信完了/i.test(name);

export function GoogleAdsView({ range }: GoogleAdsViewProps = {}) {
  const [raw, setRaw] = useState<AdsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thanksOnly, setThanksOnly] = useState(false);

  useEffect(() => {
    fetch("/api/ads")
      .then((r) => r.json())
      .then((j) => {
        if (j.connected) setRaw(j.data);
        else setError(j.message ?? "not connected");
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return <div className="card text-[#6E6E73] text-sm">Google広告データの取得に失敗しました: {error}</div>;
  }
  if (!raw) return <div className="card text-[#6E6E73] text-sm">読み込み中...</div>;

  // Filter the 30-day timeline to the requested range and recompute totals.
  // 注意: Google広告は「遅れて届く固定30日スクレイプ」。プリセット(過去7日等)は
  // 今日(JST)基準で算出されるため、スクレイプ窓と重ならないことがある。
  // その場合に全30日合計へフォールバックすると「過去7日 > 過去14日」のような
  // 矛盾が起きるので、重なりゼロは raw に化けさせず「データなし」を返す。
  const OUT_OF_RANGE = "__out_of_range__" as const;
  const filtered = (() => {
    if (!range?.from || !range?.to) return raw;
    const inRange = raw.timeline.filter((d) => d.date >= range.from && d.date <= range.to);
    if (inRange.length === raw.timeline.length) return raw; // 全期間一致＝フルデータ
    if (inRange.length === 0) return OUT_OF_RANGE;          // スクレイプ窓外＝データなし
    const totalCost = inRange.reduce((s, d) => s + (d.cost || 0), 0);
    const totalClicks = inRange.reduce((s, d) => s + (d.clicks || 0), 0);
    const totalCv = inRange.reduce(
      (s, d) => s + (d.conversions ?? d.conversionsPrimary ?? 0),
      0,
    );
    const days = inRange.length;
    const cpc = totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0;
    const cpa = totalCv > 0 ? Math.round(totalCost / totalCv) : 0;
    return {
      ...raw,
      timeline: inRange,
      days,
      period: { from: range.from, to: range.to },
      totals: {
        ...raw.totals,
        cost: totalCost,
        clicks: totalClicks,
        conversions: totalCv,
        cpc,
        cpa,
      },
    };
  })();

  if (filtered === OUT_OF_RANGE) {
    return (
      <div className="card text-sm text-[#6E6E73] space-y-1.5">
        <div className="text-[#1D1D1F] font-medium">
          選択期間（{range?.from} 〜 {range?.to}）に Google広告データがありません
        </div>
        <div className="text-[12px]">
          Google広告は直近約30日の固定スクレイプです。データ期間は{" "}
          <span className="font-medium text-[#1D1D1F]">{raw.period.from} 〜 {raw.period.to}</span>
          （取得:{" "}
          {new Date(raw.scrapedAt).toLocaleString("ja-JP", {
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
          })}
          ）。この範囲内で期間を選択してください。
        </div>
      </div>
    );
  }
  const data = filtered;

  const scrapedDate = new Date(data.scrapedAt).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <SectionHeader
            title="Google広告 サマリー"
            sub={`${data.accountName}（${data.customerId}）・${data.period.from} 〜 ${data.period.to}`}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]">
            ✓ 実データ（Playwright CSV）
          </span>
          <span className="text-[11px] text-[#6E6E73]">取得: {scrapedDate}</span>
        </div>
      </div>

      {(() => {
        const thanksItems = data.cvActions?.items.filter((a) => isThanksAction(a.name)) || [];
        const thanksTotal = thanksItems.reduce((s, a) => s + a.allConversions, 0);
        const thanksCpa = thanksTotal > 0 ? Math.round(data.totals.cost / thanksTotal) : 0;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard label="費用" value={fmt.yen(data.totals.cost)} sub={`${data.days}日間`} />
            <MetricCard label="クリック数" value={fmt.num(data.totals.clicks)} sub={`${data.days}日間`} />
            <MetricCard label="コンバージョン" value={data.totals.conversions.toFixed(2)} sub={`${data.days}日間（全種別）`} />
            <MetricCard
              label="実質CV"
              value={thanksTotal.toFixed(2)}
              sub={`サンクス到達のみ・${thanksItems.length}種類`}
            />
            <MetricCard label="CPA" value={fmt.yen(data.totals.cpa)} sub="全CV基準" />
            <MetricCard label="実質CPA" value={fmt.yen(thanksCpa)} sub="サンクス到達基準" />
            <MetricCard label="検索CTR" value={fmt.pct(data.totals.searchCtr, 2)} sub="検索キーワードのみ" />
          </div>
        );
      })()}

      {data.cvActions && data.cvActions.items.length > 0 && (() => {
        const allItems = data.cvActions!.items;
        const thanksItems = allItems.filter((a) => isThanksAction(a.name));
        const displayItems = thanksOnly ? thanksItems : allItems;
        const displayTotal = displayItems.reduce((s, a) => s + a.allConversions, 0);
        return (
        <div className="card">
          <SectionHeader
            title="コンバージョン種類別 内訳"
            sub={`${data.cvActions!.period || "過去30日"}・全${data.cvActions!.total}種類・合計 ${data.cvActions!.totalAllConversions.toFixed(2)} CV（すべてのコンバージョン）／ サンクス到達のみ合計 ${thanksItems.reduce((s, a) => s + a.allConversions, 0).toFixed(2)}`}
          />
          <div className="flex items-center gap-2 mb-4 -mt-2">
            <button
              type="button"
              onClick={() => setThanksOnly(false)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !thanksOnly
                  ? "bg-[#1D1D1F] text-white"
                  : "bg-[#F0F0F0] text-[#6E6E73] hover:bg-[#E5E5E7]"
              }`}
            >
              全て表示（{allItems.length}）
            </button>
            <button
              type="button"
              onClick={() => setThanksOnly(true)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                thanksOnly
                  ? "bg-[#1B5E20] text-white"
                  : "bg-[#F0F0F0] text-[#6E6E73] hover:bg-[#E5E5E7]"
              }`}
            >
              サンクス到達のみ（{thanksItems.length}）
            </button>
            <span className="text-[11px] text-[#6E6E73] ml-1">
              ※ 名前に「サンクス」を含むアクションを実質CVとして抽出
            </span>
          </div>
          <div className="space-y-3 mb-4">
            {displayItems.map((a) => {
              const isThanks = isThanksAction(a.name);
              const pct = displayTotal > 0 ? (a.allConversions / displayTotal) * 100 : 0;
              return (
                <div key={a.name}>
                  <div className="flex items-baseline justify-between mb-1 gap-3">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-medium text-[#1D1D1F] truncate">{a.name}</span>
                      {isThanks && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8F5E9] text-[#1B5E20] font-medium shrink-0">
                          実質CV
                        </span>
                      )}
                      {a.category && (
                        <span className="text-[11px] text-[#6E6E73] shrink-0">{a.category}</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3 shrink-0">
                      <span className="text-sm tabular-nums font-semibold text-[#1B5E20]">
                        {a.allConversions.toFixed(2)} <span className="text-xs text-[#6E6E73] font-normal">CV</span>
                      </span>
                      <span className="text-[11px] tabular-nums text-[#6E6E73] w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isThanks ? "bg-[#1B5E20]" : "bg-[#30D158]"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {displayItems.length === 0 && (
              <p className="text-sm text-[#6E6E73] py-4 text-center">該当するアクションがありません</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                  <th className="py-2 font-medium">アクション</th>
                  <th className="py-2 font-medium">カテゴリ</th>
                  <th className="py-2 font-medium">ソース</th>
                  <th className="py-2 font-medium text-right">すべてのCV</th>
                  <th className="py-2 font-medium text-right">主要CV</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((a) => (
                  <tr key={`t-${a.name}`} className={`border-b border-[#F0F0F0] ${isThanksAction(a.name) ? "bg-[#F1F8E9]" : ""}`}>
                    <td className="py-2 font-medium text-[#1D1D1F]">
                      {a.name}
                      {isThanksAction(a.name) && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#E8F5E9] text-[#1B5E20] font-medium">実質CV</span>
                      )}
                    </td>
                    <td className="py-2 text-[#6E6E73]">{a.category || "-"}</td>
                    <td className="py-2 text-[#6E6E73]">{a.source || "-"}</td>
                    <td className="py-2 text-right tabular-nums">{a.allConversions.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{a.primaryConversions.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[#6E6E73]">
            ※「すべてのコンバージョン」は全CV種別の合計、「主要CV」は主要アクションに設定されたものだけ。「実質CV」は名前に「サンクス」を含むサンクスページ到達アクション（申込完了相当）。
          </p>
        </div>
      );
      })()}

      <div className="card">
        <SectionHeader title="日次トレンド" sub="クリック・CV・費用の推移" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tickFormatter={fmt.shortDate} stroke="#6E6E73" fontSize={11} />
              <YAxis yAxisId="left" stroke="#6E6E73" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#6E6E73" fontSize={11} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }}
                labelFormatter={(l: unknown) => fmt.shortDate(String(l))}
                formatter={(value: unknown, name: unknown) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return name === "CV" ? [v.toFixed(2), String(name)] : [v, String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#30D158" strokeWidth={2} name="クリック" dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="conversions" stroke="#FF9500" strokeWidth={2} name="CV" dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#0071E3" strokeWidth={2} name="費用(円)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[11px] text-[#6E6E73]">
          ※ 日次CVは「費用 ÷ コンバージョン単価」で逆算した目安値。総計はキャンペーン別CSVと一致します。
        </p>
      </div>

      <div className="card">
        <SectionHeader title="日付別CV内訳" sub="CV発生日が一目で分かる表" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                <th className="py-2 font-medium">日付</th>
                <th className="py-2 font-medium text-right">CV</th>
                <th className="py-2 font-medium text-right">クリック</th>
                <th className="py-2 font-medium text-right">費用</th>
                <th className="py-2 font-medium text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {data.timeline
                .filter((d) => (d.conversions ?? 0) > 0)
                .slice()
                .reverse()
                .map((d) => {
                  const cv = d.conversions ?? 0;
                  const cpa = cv > 0 ? Math.round(d.cost / cv) : 0;
                  return (
                    <tr key={d.date} className="border-b border-[#F0F0F0]">
                      <td className="py-2 font-medium">{fmt.shortDate(d.date)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-[#FF9500]">{cv.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt.num(d.clicks)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt.yen(d.cost)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt.yen(cpa)}</td>
                    </tr>
                  );
                })}
              {data.timeline.filter((d) => (d.conversions ?? 0) > 0).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-[#6E6E73]">この期間にCVは発生していません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.network && data.network.length > 0 && (
        <div className="card">
          <SectionHeader title="ネットワーク別内訳" sub="費用・クリック配分の透明性" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                  <th className="py-2 font-medium">ネットワーク</th>
                  <th className="py-2 font-medium text-right">費用</th>
                  <th className="py-2 font-medium text-right">クリック</th>
                  <th className="py-2 font-medium text-right">平均CPC</th>
                  <th className="py-2 font-medium text-right">費用構成比</th>
                </tr>
              </thead>
              <tbody>
                {data.network.map((n) => (
                  <tr key={n.name} className="border-b border-[#F0F0F0]">
                    <td className="py-2 font-medium">{n.name}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.yen(n.cost)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.num(n.clicks)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.yen(n.cpc)}</td>
                    <td className="py-2 text-right tabular-nums text-[#6E6E73]">{data.totals.cost ? ((n.cost / data.totals.cost) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <SectionHeader title="キャンペーン別パフォーマンス" />
        <div className="h-72 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.campaigns} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis type="number" stroke="#6E6E73" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#6E6E73" fontSize={11} width={200} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D2D2D7", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="cost" fill="#0071E3" name="費用" radius={[0, 6, 6, 0]} />
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
                <th className="py-3 font-medium text-right">費用</th>
                <th className="py-3 font-medium text-right">CV</th>
                <th className="py-3 font-medium text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.name} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
                  <td className="py-3 font-medium text-[#1D1D1F]">{c.name}</td>
                  <td className="py-3 text-[#6E6E73]">{c.status}</td>
                  <td className="py-3 text-right tabular-nums">{fmt.yen(c.cost)}</td>
                  <td className="py-3 text-right tabular-nums">{c.conversions.toFixed(2)}</td>
                  <td className="py-3 text-right tabular-nums font-semibold">{fmt.yen(c.cpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <SectionHeader title="デバイス別" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                  <th className="py-2 font-medium">デバイス</th>
                  <th className="py-2 font-medium text-right">費用</th>
                  <th className="py-2 font-medium text-right">クリック</th>
                  <th className="py-2 font-medium text-right">CV</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((d) => (
                  <tr key={d.device} className="border-b border-[#F0F0F0]">
                    <td className="py-2 font-medium">{d.device}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.yen(d.cost)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.num(d.clicks)}</td>
                    <td className="py-2 text-right tabular-nums">{d.conversions.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="ユーザーが検索したクエリ TOP15" sub={`全${data.searchTerms.length}件中・表示回数順`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                  <th className="py-2 font-medium">クエリ</th>
                  <th className="py-2 font-medium text-right">表示</th>
                  <th className="py-2 font-medium text-right">クリック</th>
                  <th className="py-2 font-medium text-right">費用</th>
                </tr>
              </thead>
              <tbody>
                {data.searchTerms.slice(0, 15).map((s, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    <td className="py-2 text-[#1D1D1F] max-w-xs truncate">{s.term}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.num(s.impressions)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.num(s.clicks)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.yen(s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[#6E6E73]">
            ※ 概要CSVの検索クエリにはCVが紐付きません（Google広告UIの仕様）。CVは下記のキャンペーン別合計が正確です。
          </p>
        </div>
      </div>

      {data.biddedKeywords && data.biddedKeywords.length > 0 && (
        <div className="card">
          <SectionHeader title="出稿中キーワード TOP20" sub={`費用降順・全${data.biddedKeywords.length}キーワード`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                  <th className="py-2 font-medium">キーワード</th>
                  <th className="py-2 font-medium">マッチタイプ</th>
                  <th className="py-2 font-medium">ステータス</th>
                  <th className="py-2 font-medium text-right">費用</th>
                  <th className="py-2 font-medium text-right">クリック</th>
                  <th className="py-2 font-medium text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {data.biddedKeywords.slice(0, 20).map((k, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    <td className="py-2 font-medium text-[#1D1D1F]">{k.keyword}</td>
                    <td className="py-2 text-[#6E6E73] text-xs">{k.matchType}</td>
                    <td className="py-2 text-xs">
                      <span className={k.status === "有効" ? "text-[#1B5E20]" : "text-[#6E6E73]"}>{k.status}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmt.yen(k.cost)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.num(k.clicks)}</td>
                    <td className="py-2 text-right tabular-nums">{k.ctr.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.searchTermsCv && data.searchTermsCv.items.length > 0 && (
        <div className="card">
          <SectionHeader
            title="CVを生んだ検索クエリ"
            sub={`CV発生: ${data.searchTermsCv.withCv}件 / 合計CV: ${data.searchTermsCv.totalCv.toFixed(2)}`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6E6E73] border-b border-[#D2D2D7]">
                  <th className="py-2 font-medium">クエリ</th>
                  <th className="py-2 font-medium">キャンペーン</th>
                  <th className="py-2 font-medium text-right">CV</th>
                  <th className="py-2 font-medium text-right">クリック</th>
                  <th className="py-2 font-medium text-right">費用</th>
                </tr>
              </thead>
              <tbody>
                {data.searchTermsCv.items.filter((x) => x.conversions > 0).slice(0, 20).map((s, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    <td className="py-2 text-[#1D1D1F] max-w-xs truncate">{s.term}</td>
                    <td className="py-2 text-[#6E6E73] text-xs max-w-[14rem] truncate">{s.campaign || "-"}</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-[#1B5E20]">{s.conversions.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.num(s.clicks)}</td>
                    <td className="py-2 text-right tabular-nums">{fmt.yen(s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {((data.gender && data.gender.length > 0) || (data.age && data.age.length > 0)) && (
        <div className="grid lg:grid-cols-2 gap-6">
          {data.gender && data.gender.length > 0 && (
            <div className="card">
              <SectionHeader title="性別構成" sub="広告表示の性別割合（既知データ）" />
              <div className="space-y-3">
                {data.gender.map((g) => (
                  <div key={g.label}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium">{g.label}</span>
                      <span className="text-sm tabular-nums text-[#6E6E73]">{fmt.num(g.impressions)} 表示 ({g.share}%)</span>
                    </div>
                    <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0071E3] rounded-full" style={{ width: `${Math.min(g.share, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.age && data.age.length > 0 && (
            <div className="card">
              <SectionHeader title="年齢別構成" sub="広告表示の年齢分布（既知データ）" />
              <div className="space-y-2">
                {data.age.map((a) => (
                  <div key={a.label}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium">{a.label}</span>
                      <span className="text-sm tabular-nums text-[#6E6E73]">{fmt.num(a.impressions)} ({a.share}%)</span>
                    </div>
                    <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#30D158] rounded-full" style={{ width: `${Math.min(a.share * 2, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card bg-[#F9F9FB]">
        <div className="text-xs text-[#6E6E73]">
          <p className="font-semibold mb-1">📋 データについて</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Google広告の「ダウンロード→CSV」をPlaywrightで自動取得した実データです（概要ページ・過去30日・15種類のCSVをパース）</li>
            <li>整合性チェック済: ネットワーク合計clicks/費用 = キャンペーン合計 = タイムライン合計で一致</li>
            <li>表示回数はキャンペーン全体の計測が無く、検索キーワード別集計のみ（API接続後に全量取得予定）</li>
            <li>自動更新: 毎朝07:00に Windows Task Scheduler で再取得 → Vercel再デプロイ</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
