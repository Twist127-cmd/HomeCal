import type { GeoPoint, TravelMode } from "@/lib/types";
import type { Route } from "./RoutingProvider";

const PROFILE: Record<TravelMode, { base: string; profile: string }> = {
  driving: { base: "https://routing.openstreetmap.de/routed-car", profile: "driving" },
  cycling: { base: "https://routing.openstreetmap.de/routed-bike", profile: "cycling" },
  walking: { base: "https://routing.openstreetmap.de/routed-foot", profile: "foot" },
};

interface OsrmResponse {
  code: string;
  routes?: { duration: number; distance: number }[];
}

async function osrm(base: string, profile: string, from: GeoPoint, to: GeoPoint): Promise<{ duration: number; distance: number }> {
  const url = `${base}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": process.env.GEOCODING_USER_AGENT || "HomeCal/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = (await res.json()) as OsrmResponse;
  if (data.code !== "Ok" || !data.routes?.length) throw new Error(`OSRM ${data.code}`);
  return data.routes[0];
}

/** Free OSRM routing (FOSSGIS servers, fallback: project-osrm demo server for cars). */
export async function serverRoute(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<Route> {
  const p = PROFILE[mode];
  let r: { duration: number; distance: number };
  try {
    r = await osrm(p.base, p.profile, from, to);
  } catch (e) {
    if (mode !== "driving") throw e;
    r = await osrm("https://router.project-osrm.org", "driving", from, to);
  }
  return {
    durationMin: Math.max(1, Math.round(r.duration / 60)),
    distanceKm: Math.round((r.distance / 1000) * 10) / 10,
    mode,
    source: "osrm",
  };
}
