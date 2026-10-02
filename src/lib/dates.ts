import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";

export const WEEK_OPTS = { weekStartsOn: 1 as const, locale: fr };

export type ViewMode = "day" | "week" | "month" | "agenda";

export function viewRange(view: ViewMode, anchor: Date): { start: Date; end: Date } {
  switch (view) {
    case "day":
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case "week":
      return { start: startOfWeek(anchor, WEEK_OPTS), end: endOfWeek(anchor, WEEK_OPTS) };
    case "month": {
      // full weeks covering the month grid
      const s = startOfWeek(startOfMonth(anchor), WEEK_OPTS);
      const e = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
      return { start: s, end: e };
    }
    case "agenda":
      return { start: startOfDay(anchor), end: endOfDay(addDays(anchor, 30)) };
  }
}

export function daysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let d = startOfDay(start);
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export function fmt(d: Date, pattern: string): string {
  return format(d, pattern, { locale: fr });
}

/** "16h", "16h30" */
export function fmtTime(d: Date): string {
  const m = d.getMinutes();
  return m === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(m).padStart(2, "0")}`;
}

export function fmtRange(start: Date, end: Date, allDay = false): string {
  if (allDay) return "Toute la journée";
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Aujourd'hui", "Demain", "Jeudi 12 octobre" */
export function fmtRelativeDay(d: Date, now = new Date()): string {
  if (isSameDay(d, now)) return "Aujourd'hui";
  if (isSameDay(d, addDays(now, 1))) return "Demain";
  if (isSameDay(d, addDays(now, -1))) return "Hier";
  return capitalize(fmt(d, "EEEE d MMMM"));
}

/** Combine a date (day) and "HH:mm" into a Date. */
export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function toDateInput(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromDateInput(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Is "now" inside the window [start, end) expressed as "HH:mm" (may wrap midnight). */
export function inTimeWindow(now: Date, start: string, end: string): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function clampToDay(start: Date, end: Date, day: Date): { start: Date; end: Date } | null {
  const ds = startOfDay(day);
  const de = addDays(ds, 1);
  if (!overlaps(start, end, ds, de)) return null;
  return { start: start < ds ? ds : start, end: end > de ? de : end };
}

export { addDays, addMinutes, differenceInMinutes, isSameDay, startOfDay };
