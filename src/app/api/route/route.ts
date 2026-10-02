import { NextResponse, type NextRequest } from "next/server";
import { serverRoute } from "@/providers/routing/server";
import type { TravelMode } from "@/lib/types";

const MODES: TravelMode[] = ["driving", "cycling", "walking"];

function point(s: string | null) {
  const [lat, lng] = (s ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export async function GET(req: NextRequest) {
  const from = point(req.nextUrl.searchParams.get("from"));
  const to = point(req.nextUrl.searchParams.get("to"));
  const mode = (req.nextUrl.searchParams.get("mode") ?? "driving") as TravelMode;
  if (!from || !to || !MODES.includes(mode)) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  try {
    const r = await serverRoute(from, to, mode);
    return NextResponse.json(r, { headers: { "Cache-Control": "public, s-maxage=3600, max-age=600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
