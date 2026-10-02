import { estimateTravel } from "@/lib/geo";
import type { GeoPoint, TravelMode } from "@/lib/types";

export interface Route {
  durationMin: number;
  distanceKm: number;
  mode: TravelMode;
  /** "osrm" = real road network, "estimate" = straight-line fallback */
  source: "osrm" | "estimate";
}

export interface RoutingProvider {
  readonly id: string;
  route(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<Route>;
}

/**
 * Browser-side provider: /api/route proxies the free FOSSGIS OSRM servers
 * (routing.openstreetmap.de: car, bike, foot). Falls back to an offline estimate.
 */
export class HttpRoutingProvider implements RoutingProvider {
  readonly id = "osrm";
  private cache = new Map<string, Route>();

  async route(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<Route> {
    const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}:${mode}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    try {
      const params = new URLSearchParams({
        from: `${from.lat},${from.lng}`,
        to: `${to.lat},${to.lng}`,
        mode,
      });
      const res = await fetch(`/api/route?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = (await res.json()) as Route;
      this.cache.set(key, r);
      return r;
    } catch {
      return { ...estimateTravel(from, to, mode), mode, source: "estimate" };
    }
  }
}
