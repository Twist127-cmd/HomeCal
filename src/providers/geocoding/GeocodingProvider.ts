export interface GeocodeResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  readonly id: string;
  search(query: string, near?: { lat: number; lng: number }): Promise<GeocodeResult[]>;
  reverse?(lat: number, lng: number): Promise<GeocodeResult | null>;
}

/**
 * Browser-side provider: calls the HomeCal /api/geocode route, which proxies
 * Photon (komoot, OSM data, free) with a Nominatim fallback — no API key.
 */
export class HttpGeocodingProvider implements GeocodingProvider {
  readonly id = "photon+nominatim";
  private cache = new Map<string, GeocodeResult[]>();

  async search(query: string, near?: { lat: number; lng: number }): Promise<GeocodeResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const params = new URLSearchParams({ q });
    if (near) {
      params.set("lat", String(near.lat));
      params.set("lng", String(near.lng));
    }
    const res = await fetch(`/api/geocode?${params}`);
    if (!res.ok) throw new Error(`Géocodage indisponible (${res.status})`);
    const data = (await res.json()) as { results: GeocodeResult[] };
    this.cache.set(key, data.results);
    return data.results;
  }
}
