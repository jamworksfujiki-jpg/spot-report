import { NextRequest, NextResponse } from "next/server";
import { fetchGa4Report, GA4_PROPERTIES, lastNDays } from "@/lib/ga4";

// GA4 data changes daily — cache each unique (propertyId, days) for 1 hour.
// This cuts external GA4 API calls dramatically (and the tiny quota risk) while
// keeping the dashboard fresh.
export const revalidate = 3600;

const memo = new Map<string, { at: number; json: unknown }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId") ?? GA4_PROPERTIES[0].id;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const days = Number(searchParams.get("days") ?? "28");

  let from: string;
  let to: string;
  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    from = fromParam;
    to = toParam;
  } else {
    ({ from, to } = lastNDays(days));
  }
  const cacheKey = `${propertyId}:${from}:${to}`;

  const cached = memo.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.json, {
      headers: { "x-cache": "HIT", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  try {
    const report = await fetchGa4Report(propertyId, from, to);
    if (!report) {
      return NextResponse.json({
        connected: false,
        message: "GA4 service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON in Vercel env.",
      });
    }
    const payload = { connected: true, report };
    memo.set(cacheKey, { at: Date.now(), json: payload });
    return NextResponse.json(payload, {
      headers: { "x-cache": "MISS", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ connected: false, error: msg }, { status: 500 });
  }
}
