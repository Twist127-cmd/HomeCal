import { addDays, addMonths, addYears, getDaysInMonth, startOfWeek } from "date-fns";
import type { CalendarEvent, Occurrence, Recurrence } from "./types";

const MAX_ITERATIONS = 20000;

function occurrence(event: CalendarEvent, start: Date, durationMs: number): Occurrence {
  return {
    key: `${event.id}_${start.toISOString()}`,
    event,
    start,
    end: new Date(start.getTime() + durationMs),
  };
}

/**
 * Expand an event into the concrete occurrences that intersect [rangeStart, rangeEnd).
 * Recurrence is evaluated in local wall-clock time (keeps 18h30 across DST changes).
 */
export function expandEvent(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMs = Math.max(0, end.getTime() - start.getTime());
  const intersects = (s: Date) => s < rangeEnd && new Date(s.getTime() + durationMs) > rangeStart;

  if (!event.recurrence) {
    // zero-length events still show when their start is in range
    if (intersects(start) || (durationMs === 0 && start >= rangeStart && start < rangeEnd)) {
      return [occurrence(event, start, durationMs)];
    }
    return [];
  }

  const rule = event.recurrence;
  const exdates = new Set((rule.exdates ?? []).map((d) => new Date(d).getTime()));
  const until = rule.until ? new Date(rule.until) : null;
  const out: Occurrence[] = [];
  let produced = 0;

  for (const candidate of candidates(start, rule)) {
    if (until && candidate > until) break;
    if (rule.count !== undefined && produced >= rule.count) break;
    if (candidate >= rangeEnd) break;
    produced++;
    if (exdates.has(candidate.getTime())) continue;
    if (intersects(candidate)) out.push(occurrence(event, candidate, durationMs));
  }
  return out;
}

/** Ordered generator of recurrence start dates, beginning with the event start. */
function* candidates(start: Date, rule: Recurrence): Generator<Date> {
  const interval = Math.max(1, rule.interval || 1);
  let i = 0;

  switch (rule.freq) {
    case "DAILY":
      for (let n = 0; i < MAX_ITERATIONS; n += interval, i++) yield addDays(start, n);
      return;

    case "WEEKLY": {
      const days = (rule.byWeekday?.length ? [...rule.byWeekday] : [start.getDay()])
        // order Monday..Sunday
        .map((d) => (d + 6) % 7)
        .sort((a, b) => a - b);
      const week0 = startOfWeek(start, { weekStartsOn: 1 });
      for (let w = 0; i < MAX_ITERATIONS; w += interval) {
        for (const offset of days) {
          const day = addDays(week0, w * 7 + offset);
          const d = new Date(day);
          d.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
          if (d < start) continue;
          i++;
          yield d;
        }
      }
      return;
    }

    case "MONTHLY": {
      const dom = start.getDate();
      for (let n = 0; i < MAX_ITERATIONS; n += interval, i++) {
        const monthStart = addMonths(new Date(start.getFullYear(), start.getMonth(), 1), n);
        if (dom > getDaysInMonth(monthStart)) continue;
        const d = new Date(monthStart);
        d.setDate(dom);
        d.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        yield d;
      }
      return;
    }

    case "YEARLY":
      for (let n = 0; i < MAX_ITERATIONS; n += interval, i++) {
        const d = addYears(start, n);
        // skip Feb 29 on non-leap years (addYears would clamp to Feb 28)
        if (d.getDate() !== start.getDate()) continue;
        yield d;
      }
      return;
  }
}

export function expandEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
}

const WEEKDAY_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function describeRecurrence(rule: Recurrence | undefined): string {
  if (!rule) return "Ne se répète pas";
  const n = rule.interval > 1 ? rule.interval : 0;
  let base: string;
  switch (rule.freq) {
    case "DAILY":
      base = n ? `Tous les ${n} jours` : "Tous les jours";
      break;
    case "WEEKLY": {
      const days = rule.byWeekday?.length
        ? " le " + [...rule.byWeekday].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_FR[d]).join(", ")
        : "";
      base = (n ? `Toutes les ${n} semaines` : "Chaque semaine") + days;
      break;
    }
    case "MONTHLY":
      base = n ? `Tous les ${n} mois` : "Chaque mois";
      break;
    case "YEARLY":
      base = n ? `Tous les ${n} ans` : "Chaque année";
      break;
  }
  if (rule.count) base += `, ${rule.count} fois`;
  if (rule.until) base += `, jusqu'au ${new Date(rule.until).toLocaleDateString("fr-CH")}`;
  return base;
}
