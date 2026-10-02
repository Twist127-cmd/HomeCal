import type { EventLocation, GeoPoint, TravelMode } from "./types";

export function hasCoords(l?: EventLocation | null): l is EventLocation & GeoPoint {
  return !!l && typeof l.lat === "number" && typeof l.lng === "number";
}

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SPEED_KMH: Record<TravelMode, number> = { driving: 35, cycling: 15, walking: 4.8 };
/** Driving beyond the first 15 km is mostly motorway */
const MOTORWAY_KMH = 80;
/** Road distance is longer than straight line */
const DETOUR = 1.3;

/** Rough offline estimate, used when the routing service is unavailable. */
export function estimateTravel(a: GeoPoint, b: GeoPoint, mode: TravelMode): { durationMin: number; distanceKm: number } {
  const distanceKm = Math.round(haversineKm(a, b) * DETOUR * 10) / 10;
  let hours: number;
  if (mode === "driving") {
    const urban = Math.min(distanceKm, 15);
    hours = urban / SPEED_KMH.driving + Math.max(0, distanceKm - 15) / MOTORWAY_KMH;
  } else {
    hours = distanceKm / SPEED_KMH[mode];
  }
  const overhead = mode === "driving" ? 5 : 0; // parking etc.
  return { distanceKm, durationMin: Math.round(hours * 60 + overhead) };
}
