import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 【2026-07-31】取得できなかった項目（undefined/null/NaN）が渡ると
// n.toFixed / n.toLocaleString が例外を投げ、画面全体が
// "Application error: a client-side exception has occurred" で真っ白になっていた。
// データが欠けること自体は起こりうるので、フォーマッタ側で「—」に倒して
// 1項目の欠損でダッシュボード全部が死ぬ構造をやめる。
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export const fmt = {
  yen: (n?: number | null) => (isNum(n) ? `¥${n.toLocaleString("ja-JP")}` : "—"),
  num: (n?: number | null) => (isNum(n) ? n.toLocaleString("ja-JP") : "—"),
  pct: (n?: number | null, decimals = 1) => (isNum(n) ? `${n.toFixed(decimals)}%` : "—"),
  shortDate: (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
  },
};
