import { NextResponse, type NextRequest } from "next/server";
import { geocode } from "@/providers/geocoding/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 200) return NextResponse.json({ results: [] });
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : undefined;
  try {
    const results = await geocode(q, near);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ results: [], error: (e as Error).message }, { status: 502 });
  }
}
