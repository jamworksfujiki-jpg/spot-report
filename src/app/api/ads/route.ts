import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import adsData from "@/lib/scraped-data/ads.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function loadOptional(filename: string): unknown {
  try {
    const p = path.join(process.cwd(), "src", "lib", "scraped-data", filename);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET() {
  const searchTermsCv = loadOptional("ads-searchterms.json");
  const cvActions = loadOptional("ads-cv-actions.json");
  return NextResponse.json({ connected: true, data: { ...adsData, searchTermsCv, cvActions } });
}
