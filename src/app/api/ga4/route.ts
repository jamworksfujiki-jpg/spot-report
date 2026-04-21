import { NextRequest, NextResponse } from "next/server";
import { fetchGa4Report, GA4_PROPERTIES, lastNDays } from "@/lib/ga4";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId") ?? GA4_PROPERTIES[0].id;
  const days = Number(searchParams.get("days") ?? "28");
  const { from, to } = lastNDays(days);

  try {
    const report = await fetchGa4Report(propertyId, from, to);
    if (!report) {
      return NextResponse.json({
        connected: false,
        message: "GA4 service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON in Vercel env.",
      });
    }
    return NextResponse.json({ connected: true, report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ connected: false, error: msg }, { status: 500 });
  }
}
