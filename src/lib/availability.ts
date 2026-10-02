import { addDays, startOfDay } from "date-fns";
import { resolvePersons } from "./profiles";
import type { Occurrence, Profile } from "./types";

export interface Slot {
  start: Date;
  end: Date;
}

export interface AvailabilityQuery {
  occurrences: Occurrence[];
  profiles: Profile[];
  /** Profiles that must all be free (couples/groups are expanded to persons). */
  profileIds: string[];
  from: Date;
  to: Date;
  durationMin: number;
  dayStartHour?: number;
  dayEndHour?: number;
  /** Buffer kept free around busy events, minutes */
  bufferMin?: number;
  /** All-day events block the whole day when true (default false: birthdays etc. don't block) */
  allDayBlocks?: boolean;
  maxResults?: number;
}

/**
 * Find common free windows (≥ durationMin) for every person in profileIds,
 * restricted to [dayStartHour, dayEndHour) each day.
 */
export function findAvailability(q: AvailabilityQuery): Slot[] {
  const dayStart = q.dayStartHour ?? 8;
  const dayEnd = q.dayEndHour ?? 22;
  const buffer = q.bufferMin ?? 0;
  const durationMs = q.durationMin * 60000;
  const persons = resolvePersons(q.profileIds, q.profiles);

  const busy: Slot[] = q.occurrences
    .filter((o) => q.allDayBlocks || !o.event.allDay)
    .filter((o) => {
      const p = resolvePersons(o.event.profileIds, q.profiles);
      return [...p].some((x) => persons.has(x));
    })
    .map((o) => ({
      start: new Date(o.start.getTime() - buffer * 60000),
      end: new Date(o.end.getTime() + buffer * 60000),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged = mergeSlots(busy);
  const out: Slot[] = [];

  for (let day = startOfDay(q.from); day < q.to; day = addDays(day, 1)) {
    let winStart = new Date(day);
    winStart.setHours(dayStart, 0, 0, 0);
    const winEnd = new Date(day);
    if (dayEnd >= 24) winEnd.setHours(23, 59, 59, 999);
    else winEnd.setHours(dayEnd, 0, 0, 0);
    if (winStart < q.from) winStart = new Date(q.from);
    const end = winEnd > q.to ? q.to : winEnd;
    if (winStart >= end) continue;

    let cursor = winStart;
    for (const b of merged) {
      if (b.end <= cursor) continue;
      if (b.start >= end) break;
      if (b.start.getTime() - cursor.getTime() >= durationMs) out.push({ start: cursor, end: b.start });
      if (b.end > cursor) cursor = b.end;
      if (cursor >= end) break;
    }
    if (end.getTime() - cursor.getTime() >= durationMs) out.push({ start: cursor, end });
    if (q.maxResults && out.length >= q.maxResults) return out.slice(0, q.maxResults);
  }
  return out;
}

export function mergeSlots(slots: Slot[]): Slot[] {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Slot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) {
      if (s.end > last.end) last.end = s.end;
    } else out.push({ start: s.start, end: s.end });
  }
  return out;
}
