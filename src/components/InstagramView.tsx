"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { SectionHeader } from "./SectionHeader";

type IgPost = { url: string; caption: string; postedAt?: string | null };
type IgData = {
  username: string;
  displayName: string;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  recentPosts: IgPost[];
  scrapedAt: string;
};

export function InstagramView() {
  const [data, setData] = useState<IgData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instagram")
      .then((r) => r.json())
      .then((json) => {
        if (json.connected) setData(json.data);
        else setError(json.message ?? "not connected");
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="card text-[#6E6E73] text-sm">
        Instagramデータの取得に失敗しました: {error}
      </div>
    );
  }

  if (!data) {
    return <div className="card text-[#6E6E73] text-sm">読み込み中...</div>;
  }

  const scrapedDate = new Date(data.scrapedAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <SectionHeader
          title={`Instagram @${data.username}`}
          sub={`${data.displayName}・取得日時: ${scrapedDate}`}
        />
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]">
          ✓ 実データ（Playwright）
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="フォロワー" value={fmt.num(data.followers ?? 0)} sub="現在" />
        <MetricCard label="フォロー中" value={fmt.num(data.following ?? 0)} sub="現在" />
        <MetricCard label="投稿数" value={fmt.num(data.postsCount ?? 0)} sub="累計" />
        <MetricCard label="取得件数" value={String(data.recentPosts.length)} sub="最近の投稿" />
      </div>

      <div className="card">
        <SectionHeader title="最近の投稿" sub={`${data.recentPosts.length}件`} />
        <div className="space-y-2">
          {data.recentPosts.map((p, i) => {
            const dateLabel = p.postedAt ? new Date(p.postedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : null;
            return (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 py-3 border-b border-[#F0F0F0] last:border-0 hover:bg-[#F9F9FB] transition-colors"
              >
                <span className="text-[#6E6E73] font-semibold w-6 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1D1D1F] line-clamp-2">{p.caption || "（キャプションなし）"}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {dateLabel && <span className="text-xs text-[#6E6E73]">{dateLabel}</span>}
                    <span className="text-xs text-[#0071E3] truncate">{p.url.replace("https://www.instagram.com/", "")}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <div className="card bg-[#F9F9FB]">
        <div className="text-xs text-[#6E6E73]">
          <p className="font-semibold mb-1">📋 データについて</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Playwrightでスクレイピングした実データです</li>
            <li>リーチ/インプレッション/デモグラはInstagram Graph API接続後に追加します</li>
            <li>キャプションはグリッド画像のalt属性から取得しています</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
