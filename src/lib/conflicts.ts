import { estimateTravel, hasCoords } from "./geo";
import { resolvePersons } from "./profiles";
import type { Occurrence, Profile, TravelMode } from "./types";

export type ConflictKind = "overlap" | "travel";

export interface Conflict {
  kind: ConflictKind;
  a: Occurrence;
  b: Occurrence;
  personIds: string[];
  /** For travel conflicts: minutes missing */
  missingMin?: number;
  message: string;
}

export interface ConflictOptions {
  marginMin?: number;
  mode?: TravelMode;
  /** Return a known travel duration (minutes) between two occurrences, else undefined → estimate. */
  travelMin?: (from: Occurrence, to: Occurrence) => number | undefined;
}

/**
 * Detect overlapping events and insufficient travel time between consecutive events
 * for the same person. All-day events are ignored.
 */
export function detectConflicts(occurrences: Occurrence[], profiles: Profile[], opts: ConflictOptions = {}): Conflict[] {
  const margin = opts.marginMin ?? 0;
  const timed = occurrences
    .filter((o) => !o.event.allDay)
    .sort((x, y) => x.start.getTime() - y.start.getTime());
  const persons = new Map(timed.map((o) => [o.key, resolvePersons(o.event.profileIds, profiles)]));
  const conflicts: Conflict[] = [];

  for (let i = 0; i < timed.length; i++) {
    const a = timed[i];
    const pa = persons.get(a.key)!;
    const nextChecked = new Set<string>();

    for (let j = i + 1; j < timed.length; j++) {
      const b = timed[j];
      const pb = persons.get(b.key)!;
      const shared = [...pa].filter((p) => pb.has(p));
      if (!shared.length) continue;

      if (b.start < a.end) {
        conflicts.push({
          kind: "overlap",
          a,
          b,
          personIds: shared,
          message: `« ${a.event.title} » chevauche « ${b.event.title} »`,
        });
        continue;
      }

      // travel: only between a and the *next* event of each shared person
      const fresh = shared.filter((p) => !nextChecked.has(p));
      if (!fresh.length) continue;
      fresh.forEach((p) => nextChecked.add(p));

      const la = a.event.location;
      const lb = b.event.location;
      if (!hasCoords(la) || !hasCoords(lb)) continue;
      if (la.lat === lb.lat && la.lng === lb.lng) continue;
      const gapMin = (b.start.getTime() - a.end.getTime()) / 60000;
      const mode = b.event.travel?.mode ?? opts.mode ?? "driving";
      const needed = (opts.travelMin?.(a, b) ?? estimateTravel(la, lb, mode).durationMin) + margin;
      if (gapMin < needed) {
        conflicts.push({
          kind: "travel",
          a,
          b,
          personIds: fresh,
          missingMin: Math.ceil(needed - gapMin),
          message: `Trajet insuffisant entre « ${a.event.title} » et « ${b.event.title} » (${Math.round(needed)} min nécessaires, ${Math.round(gapMin)} min disponibles)`,
        });
      }
    }
  }
  return conflicts;
}

export function conflictsFor(key: string, conflicts: Conflict[]): Conflict[] {
  return conflicts.filter((c) => c.a.key === key || c.b.key === key);
}
