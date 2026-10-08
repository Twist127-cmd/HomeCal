"use client";

import { addDays } from "date-fns";
import { useMemo } from "react";
import { useApp } from "@/components/app/AppProvider";
import { hasCoords } from "@/lib/geo";
import { departureStatus, type DepartureStatus } from "@/lib/navigation";
import { concernsProfile } from "@/lib/profiles";
import { expandEvents } from "@/lib/recurrence";
import type { Occurrence } from "@/lib/types";
import { useTravel, type TravelInfo } from "./useTravel";

export interface NextDeparture {
  occ: Occurrence;
  travel: TravelInfo | null;
  status: DepartureStatus | null;
}

/** Next upcoming timed event (within 24 h) and its recommended departure for "me". */
export function useNextDeparture(now: Date): { next: Occurrence | null; departure: NextDeparture | null } {
  const { events, profiles, myProfileId } = useApp();
  const minute = Math.floor(now.getTime() / 60000);

  const { next, sameDay } = useMemo(() => {
    const t = minute * 60000;
    const from = new Date(t);
    const all = expandEvents(events, from, addDays(from, 1)).filter((o) => !o.event.allDay && o.start.getTime() > t);
    const mine = myProfileId ? all.filter((o) => concernsProfile(o.event.profileIds, myProfileId, profiles)) : all;
    const list = mine.length ? mine : all;
    const n = list.find((o) => hasCoords(o.event.location)) ?? list[0] ?? null;
    return { next: n, sameDay: n ? list.filter((o) => o.start.toDateString() === n.start.toDateString()) : [] };
  }, [events, profiles, myProfileId, minute]);

  const travel = useTravel(next && hasCoords(next.event.location) ? next : null, sameDay);
  const departure = next ? { occ: next, travel, status: travel ? departureStatus(travel.departAt, now) : null } : null;
  return { next, departure };
}
