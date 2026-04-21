import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = {
  yen: (n: number) => `¥${n.toLocaleString("ja-JP")}`,
  num: (n: number) => n.toLocaleString("ja-JP"),
  pct: (n: number, decimals = 1) => `${n.toFixed(decimals)}%`,
  shortDate: (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
};
