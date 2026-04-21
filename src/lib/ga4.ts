import { BetaAnalyticsDataClient } from "@google-analytics/data";

function getClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const credentials = JSON.parse(raw);
  return new BetaAnalyticsDataClient({ credentials });
}

export const GA4_PROPERTIES = [
  { id: "353940414", name: "オフィシャルページ", primary: true, siteUrl: "https://spot-s.or.jp" },
  { id: "370043223", name: "スポット社労士くん LP (A)", primary: false, siteUrl: "" },
  { id: "396798409", name: "スポット社労士くん LP (B)", primary: false, siteUrl: "" },
  { id: "524513028", name: "産休・育休応援キャンペーンLP", primary: false, siteUrl: "" },
  { id: "526078960", name: "スポットシステムLP", primary: false, siteUrl: "" },
] as const;

export type Ga4Totals = {
  pageViews: number;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  avgEngagementSec: number;
  bounceRate: number;
};

export type Ga4Timeline = { date: string; pageViews: number; users: number; sessions: number }[];

export type Ga4ArticleRow = { path: string; title: string; views: number; avgTimeSec: number; bounceRate: number };

export type Ga4Report = {
  propertyId: string;
  propertyName: string;
  period: { from: string; to: string };
  totals: Ga4Totals;
  timeline: Ga4Timeline;
  articleRanking: Ga4ArticleRow[];
  trafficSources: { source: string; users: number; share: number }[];
  transitions: { from: string; to: string; count: number; share: number }[];
  live: boolean;
};

export async function fetchGa4Report(propertyId: string, from: string, to: string): Promise<Ga4Report | null> {
  const client = getClient();
  if (!client) return null;
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: from, endDate: to }];

  const propertyMeta = GA4_PROPERTIES.find((p) => p.id === propertyId);
  const propertyName = propertyMeta?.name ?? propertyId;

  const [totalsRes, timelineRes, articlesRes, sourcesRes] = await Promise.all([
    client.runReport({
      property,
      dateRanges,
      metrics: [
        { name: "screenPageViews" },
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    }),
    client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }, { name: "bounceRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 30,
    }),
    client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    }),
  ]);

  const t = totalsRes[0].rows?.[0]?.metricValues ?? [];
  const totals: Ga4Totals = {
    pageViews: Number(t[0]?.value ?? 0),
    activeUsers: Number(t[1]?.value ?? 0),
    newUsers: Number(t[2]?.value ?? 0),
    sessions: Number(t[3]?.value ?? 0),
    avgEngagementSec: Math.round(Number(t[4]?.value ?? 0)),
    bounceRate: Math.round(Number(t[5]?.value ?? 0) * 1000) / 10,
  };

  const timeline: Ga4Timeline = (timelineRes[0].rows ?? []).map((r) => {
    const raw = r.dimensionValues?.[0]?.value ?? "";
    const iso = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
    return {
      date: iso,
      pageViews: Number(r.metricValues?.[0]?.value ?? 0),
      users: Number(r.metricValues?.[1]?.value ?? 0),
      sessions: Number(r.metricValues?.[2]?.value ?? 0),
    };
  });

  const articleRanking: Ga4ArticleRow[] = (articlesRes[0].rows ?? [])
    .map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      title: r.dimensionValues?.[1]?.value ?? "",
      views: Number(r.metricValues?.[0]?.value ?? 0),
      avgTimeSec: Math.round(Number(r.metricValues?.[1]?.value ?? 0)),
      bounceRate: Math.round(Number(r.metricValues?.[2]?.value ?? 0) * 1000) / 10,
    }))
    .filter((a) => /^\/\d+\/?$/.test(a.path) || a.path.includes("/column/") || a.path === "/")
    .slice(0, 20);

  const totalUsers = (sourcesRes[0].rows ?? []).reduce((s, r) => s + Number(r.metricValues?.[0]?.value ?? 0), 0) || 1;
  const trafficSources = (sourcesRes[0].rows ?? []).map((r) => {
    const users = Number(r.metricValues?.[0]?.value ?? 0);
    return {
      source: r.dimensionValues?.[0]?.value ?? "(not set)",
      users,
      share: Math.round((users / totalUsers) * 1000) / 10,
    };
  });

  return {
    propertyId,
    propertyName,
    period: { from, to },
    totals,
    timeline,
    articleRanking,
    trafficSources,
    transitions: [],
    live: true,
  };
}

export function lastNDays(n: number): { from: string; to: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}
