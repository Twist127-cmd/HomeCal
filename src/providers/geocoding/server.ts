import type { GeocodeResult } from "./GeocodingProvider";

/** Server-side geocoders (used by /api/geocode). Free OSM-based services. */

const UA = () => process.env.GEOCODING_USER_AGENT || "HomeCal/1.0";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
}

export async function photonSearch(q: string, near?: { lat: number; lng: number }): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q, limit: "6", lang: "fr" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { "User-Agent": UA() },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  return data.features.map((f) => {
    const p = f.properties;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const city = [p.postcode, p.city].filter(Boolean).join(" ");
    const label = p.name ?? (street || p.city || q);
    const address = [p.name && p.name !== street ? p.name : null, street || null, city || null, p.country]
      .filter(Boolean)
      .join(", ");
    return { label, address, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  });
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

export async function nominatimSearch(q: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "6", "accept-language": "fr" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": UA() },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as NominatimItem[];
  return data.map((d) => ({
    label: d.name || d.display_name.split(",")[0],
    address: d.display_name,
    lat: Number(d.lat),
    lng: Number(d.lon),
  }));
}

export async function geocode(q: string, near?: { lat: number; lng: number }): Promise<GeocodeResult[]> {
  try {
    const r = await photonSearch(q, near);
    if (r.length) return r;
  } catch {
    /* fall through */
  }
  return nominatimSearch(q);
}
