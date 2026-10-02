"use client";

import { useMemo } from "react";
import { useApp } from "@/components/app/AppProvider";
import { detectConflicts, type Conflict } from "@/lib/conflicts";
import { concernsProfile } from "@/lib/profiles";
import { expandEvents } from "@/lib/recurrence";
import type { Occurrence } from "@/lib/types";

export interface CalendarData {
  occurrences: Occurrence[];
  conflicts: Conflict[];
  conflictKeys: Set<string>;
}

/** Occurrences in [start, end), filtered by profile, plus conflicts. */
export function useOccurrences(start: Date, end: Date, profileFilter: string | null): CalendarData {
  const { events, profiles, household } = useApp();
  const s = start.getTime();
  const e = end.getTime();
  const margin = household?.settings.travelMarginMin ?? 10;
  const mode = household?.settings.defaultTravelMode ?? "driving";

  return useMemo(() => {
    const all = expandEvents(events, new Date(s), new Date(e));
    const occurrences = profileFilter ? all.filter((o) => concernsProfile(o.event.profileIds, profileFilter, profiles)) : all;
    // conflicts are computed on everything (a conflict matters even when filtered out)
    const conflicts = detectConflicts(all, profiles, { marginMin: margin, mode });
    const conflictKeys = new Set(conflicts.flatMap((c) => [c.a.key, c.b.key]));
    return { occurrences, conflicts, conflictKeys };
  }, [events, profiles, s, e, profileFilter, margin, mode]);
}
