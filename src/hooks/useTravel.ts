"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { departureTime, needsTravel, pickOrigin } from "@/lib/departure";
import { hasCoords } from "@/lib/geo";
import type { EventLocation, Occurrence } from "@/lib/types";
import type { Route } from "@/providers/routing/RoutingProvider";

export interface TravelInfo {
  origin: EventLocation;
  route: Route;
  departAt: Date;
  marginMin: number;
}

/** Route + recommended departure for an occurrence (null when no travel is needed). */
export function useTravel(occ: Occurrence | null, dayOccurrences: Occurrence[] = []): TravelInfo | null {
  const { routing, places, homePlace, household } = useApp();
  const [route, setRoute] = useState<Route | null>(null);

  const origin = useMemo(
    () => (occ ? pickOrigin(occ, dayOccurrences, places, homePlace?.id) : null),
    [occ, dayOccurrences, places, homePlace?.id],
  );
  const active = !!occ && needsTravel(occ.event, origin);
  const mode = occ?.event.travel?.mode ?? household?.settings.defaultTravelMode ?? "driving";
  const marginMin = occ?.event.travel?.marginMin ?? household?.settings.travelMarginMin ?? 10;

  const from = hasCoords(origin) ? `${origin.lat},${origin.lng}` : "";
  const loc = occ?.event.location;
  const to = hasCoords(loc) ? `${loc.lat},${loc.lng}` : "";

  useEffect(() => {
    if (!active || !from || !to) return;
    let cancelled = false;
    const [fl, fg] = from.split(",").map(Number);
    const [tl, tg] = to.split(",").map(Number);
    routing
      .route({ lat: fl, lng: fg }, { lat: tl, lng: tg }, mode)
      .then((r) => !cancelled && setRoute(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, from, to, mode, routing]);

  if (!active || !route || !origin || !occ) return null;
  return { origin, route, marginMin, departAt: departureTime(occ.start, route.durationMin, marginMin) };
}
