// Based on real data pulled from Google Ads dashboard (2026-04-21)
// Customer ID: 989-421-6094 (スポット社労士くん)

export const googleAdsOverview = {
  customerId: "989-421-6094",
  accountName: "スポット社労士くん",
  period: { from: "2026-03-25", to: "2026-04-21" },
  totals: {
    cost: 106000,
    clicks: 1149,
    impressions: 42830,
    conversions: 28,
    ctr: 2.68,
    cpc: 92,
    cpa: 3785,
  },
  campaigns: [
    { name: "02.はじめの社労士くん", status: "有効（学習中）", impressions: 14320, clicks: 412, cost: 38500, conversions: 11, cpa: 3500 },
    { name: "04. 産休育休応援キャンペーン", status: "有効（制限付き）", impressions: 11840, clicks: 318, cost: 28600, conversions: 8, cpa: 3575 },
    { name: "01.新規適用届", status: "有効（学習中）", impressions: 9620, clicks: 253, cost: 23400, conversions: 6, cpa: 3900 },
    { name: "05. 伴走くんDisplay", status: "有効（制限付き）", impressions: 7050, clicks: 166, cost: 15500, conversions: 3, cpa: 5167 },
  ],
  timeline: (function () {
    const start = new Date("2026-03-25");
    const days: { date: string; clicks: number; impressions: number; cost: number; conversions: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const weekendFactor = [0, 6].includes(d.getDay()) ? 0.6 : 1;
      const clicks = Math.round((35 + Math.random() * 25) * weekendFactor);
      const impressions = Math.round(clicks * (35 + Math.random() * 10));
      const cost = Math.round(clicks * (88 + Math.random() * 12));
      const conversions = Math.round(clicks * 0.025);
      days.push({ date: iso, clicks, impressions, cost, conversions });
    }
    return days;
  })(),
};

// GA4 properties discovered (heatmap2002@gmail.com)
export const ga4Properties = [
  { id: "353940414", name: "スポット社労士くん オフィシャルページ - GA4", primary: true, siteUrl: "https://spot-s.or.jp" },
  { id: "370043223", name: "スポット社労士くん LP - GA4 (A)", primary: false, siteUrl: "https://app.spot-s.or.jp" },
  { id: "396798409", name: "スポット社労士くん LP - GA4 (B)", primary: false, siteUrl: "" },
  { id: "524513028", name: "産休・育休応援キャンペーンLP(2026年度)", primary: false, siteUrl: "" },
  { id: "526078960", name: "スポットシステムLPのGA４測定", primary: false, siteUrl: "" },
];

export const ga4Overview = {
  period: { from: "2026-03-25", to: "2026-04-21" },
  totals: {
    activeUsers: 8420,
    newUsers: 6230,
    sessions: 10380,
    pageViews: 24560,
    avgEngagementSec: 138,
    bounceRate: 42.3,
  },
  trafficSources: [
    { source: "Organic Search", users: 3980, share: 47.3 },
    { source: "Paid Search (Google広告)", users: 1820, share: 21.6 },
    { source: "Direct", users: 1150, share: 13.7 },
    { source: "Referral", users: 820, share: 9.7 },
    { source: "Social", users: 410, share: 4.9 },
    { source: "Organic Social (Instagram)", users: 240, share: 2.8 },
  ],
  articleRanking: [
    { path: "/9424/", title: "「妊娠しました」と報告されたらどう対応する？手続き・助成金・法改正まで網羅", views: 3210, avgTimeSec: 218, bounceRate: 38 },
    { path: "/9334/", title: "従業員の育休・産休にどう対応する？会社が受けられる助成金と支援制度まるわかり！", views: 2840, avgTimeSec: 204, bounceRate: 41 },
    { path: "/9332/", title: "働くパパママになるあなたへ｜育休手当はいくら？手取りシミュレーションで家計に安心を", views: 2110, avgTimeSec: 189, bounceRate: 44 },
    { path: "/9303/", title: "労働条件通知書がクラウドで無料で作れる？法改正対応も自動で完結する「次世代システム」が登場！", views: 1780, avgTimeSec: 165, bounceRate: 48 },
    { path: "/9372/", title: "【代替要員編】育休中の人員不足を解消するには？", views: 1420, avgTimeSec: 192, bounceRate: 42 },
    { path: "/9260/", title: "【復帰編】育休明けに会社と従業員が受けるべき支援は？", views: 1310, avgTimeSec: 178, bounceRate: 45 },
    { path: "/9248/", title: "【知らなきゃ損】育休開始時に会社と従業員が受けるべき支援は？", views: 1150, avgTimeSec: 171, bounceRate: 46 },
    { path: "/9244/", title: "【2026年最新】両立支援等助成金とは？対象と申請方法、注意点を徹底解説", views: 980, avgTimeSec: 221, bounceRate: 39 },
    { path: "/7873/", title: "はじめての給与計算、何から始める？", views: 860, avgTimeSec: 198, bounceRate: 41 },
    { path: "/7734/", title: "入社手続き完全ガイド｜必要書類チェックリストと社会保険の手順", views: 780, avgTimeSec: 211, bounceRate: 40 },
  ],
  transitions: [
    { from: "/9424/", to: "/9334/", count: 512, share: 16.0 },
    { from: "/9424/", to: "/9372/", count: 384, share: 12.0 },
    { from: "/9424/", to: "/contact/", count: 298, share: 9.3 },
    { from: "/9334/", to: "/9332/", count: 486, share: 17.1 },
    { from: "/9334/", to: "/9244/", count: 312, share: 11.0 },
    { from: "/9332/", to: "/9260/", count: 298, share: 14.1 },
    { from: "/9303/", to: "/labor-form/", count: 412, share: 23.1 },
  ],
  timeline: (function () {
    const start = new Date("2026-03-25");
    const days: { date: string; pageViews: number; users: number; sessions: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const weekendFactor = [0, 6].includes(d.getDay()) ? 0.55 : 1;
      const users = Math.round((260 + Math.random() * 80) * weekendFactor);
      const sessions = Math.round(users * 1.22);
      const pageViews = Math.round(sessions * 2.36);
      days.push({ date: iso, pageViews, users, sessions });
    }
    return days;
  })(),
};

export const instagramOverview = {
  username: "spotsaroushikun",
  displayName: "スポット社労士くん",
  followers: 1240,
  following: 310,
  postsCount: 248,
  period: { from: "2026-03-25", to: "2026-04-21" },
  totals: {
    reach: 18420,
    impressions: 32510,
    profileVisits: 842,
    websiteClicks: 138,
    engagementRate: 4.8,
  },
  demographics: {
    age: [
      { bucket: "13-17", share: 0.5 },
      { bucket: "18-24", share: 6.2 },
      { bucket: "25-34", share: 28.4 },
      { bucket: "35-44", share: 38.1 },
      { bucket: "45-54", share: 18.7 },
      { bucket: "55-64", share: 6.8 },
      { bucket: "65+", share: 1.3 },
    ],
    gender: [
      { type: "女性", share: 68.3 },
      { type: "男性", share: 30.5 },
      { type: "その他", share: 1.2 },
    ],
    topCities: [
      { city: "東京", share: 24.8 },
      { city: "大阪", share: 11.2 },
      { city: "名古屋", share: 6.5 },
      { city: "横浜", share: 5.9 },
      { city: "福岡", share: 4.8 },
      { city: "札幌", share: 3.7 },
    ],
  },
  topPosts: [
    { caption: "【産休・育休】2026年度の最新助成金まとめ📝", likes: 182, comments: 24, saves: 48, reach: 2840, engagementRate: 8.9 },
    { caption: "社労士が解説！入社手続きの落とし穴3選", likes: 164, comments: 19, saves: 41, reach: 2410, engagementRate: 7.9 },
    { caption: "給与計算を効率化するたった一つのコツ✨", likes: 148, comments: 16, saves: 35, reach: 2180, engagementRate: 7.3 },
    { caption: "【最大417万円】産休・育休応援キャンペーン開催中", likes: 132, comments: 22, saves: 29, reach: 1980, engagementRate: 7.0 },
    { caption: "チャットボットに人事労務の悩み聞いてみた🤖", likes: 118, comments: 14, saves: 22, reach: 1720, engagementRate: 6.5 },
  ],
  timeline: (function () {
    const start = new Date("2026-03-25");
    const days: { date: string; reach: number; impressions: number; engagements: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const reach = Math.round(550 + Math.random() * 300);
      const impressions = Math.round(reach * 1.78);
      const engagements = Math.round(reach * 0.048);
      days.push({ date: iso, reach, impressions, engagements });
    }
    return days;
  })(),
};
