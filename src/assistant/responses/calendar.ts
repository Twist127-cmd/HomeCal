import { addDays } from "date-fns";
import { capitalize as cap, fmt, fmtRelativeDay, fmtTime, startOfDay } from "@/lib/dates";
import type { ToolResult } from "../executor";
import { joinFr } from "./common";

interface CompactEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  occurrenceStart?: string;
}

const parse = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00` : s);
const startOf = (e: CompactEvent) => parse(e.occurrenceStart ?? e.start);
const item = (e: CompactEvent) => (e.allDay ? `${e.title} (toute la journée)` : `${e.title} à ${fmtTime(startOf(e))}`);

export function calendarCreatedText(r: ToolResult, q: { title: string; start: Date; allDay: boolean; who: string[]; now: Date }): string {
  if (!r.ok) return `Je n'ai pas pu ajouter l'événement : ${r.summary}.`;
  const when = `${fmtRelativeDay(q.start, q.now).toLowerCase()}${q.allDay ? ", toute la journée" : ` à ${fmtTime(q.start)}`}`;
  return `✓ ${q.title} ajouté ${when}${q.who.length ? ` pour ${joinFr(q.who)}` : ""}.`;
}

/** "Demain : Dentiste à 16h et Réunion à 9h." */
export function describeDay(r: ToolResult, day: Date, now: Date): string {
  if (!r.ok) return `Je n'arrive pas à lire le calendrier : ${r.summary}.`;
  const isToday = day.toDateString() === now.toDateString();
  const events = ((r.data as { events?: CompactEvent[] })?.events ?? [])
    .filter((e) => {
      if (!isToday) return true;
      const end = e.end ? parse(e.end) : addDays(startOf(e), e.allDay ? 1 : 0);
      return e.allDay || end > now;
    })
    .sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || startOf(a).getTime() - startOf(b).getTime());
  const label = fmtRelativeDay(day, now);
  if (!events.length) return isToday ? "Plus rien de prévu aujourd'hui." : `${label}, rien de prévu.`;
  const items = events.slice(0, 6).map(item);
  const more = events.length > 6 ? ` et ${events.length - 6} autre(s)` : "";
  return `${label} : ${joinFr(items)}${more}.`;
}

/** Week-end / week: grouped by day. */
export function describeRange(r: ToolResult, from: Date, to: Date): string {
  if (!r.ok) return `Je n'arrive pas à lire le calendrier : ${r.summary}.`;
  const events = (r.data as { events?: CompactEvent[] })?.events ?? [];
  if (!events.length) return `Rien de prévu ${from.getDay() === 6 && to.getDay() === 0 ? "ce week-end" : "sur cette période"}.`;
  const parts: string[] = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    const list = events.filter((e) => startOf(e).toDateString() === d.toDateString());
    if (list.length) parts.push(`${cap(fmt(d, "EEEE"))} : ${joinFr(list.slice(0, 4).map(item))}`);
  }
  return `${parts.join(". ")}.`;
}

export function nextEventText(r: ToolResult, now: Date): string {
  if (!r.ok) return `Je n'arrive pas à lire le calendrier : ${r.summary}.`;
  const next = ((r.data as { events?: CompactEvent[] })?.events ?? []).find((e) => !e.allDay && startOf(e) > now);
  if (!next) return "Aucun rendez-vous prévu dans les deux prochaines semaines.";
  const start = startOf(next);
  return `Prochain rendez-vous : ${next.title}, ${fmtRelativeDay(start, now).toLowerCase()} à ${fmtTime(start)}${next.location ? ` (${next.location})` : ""}.`;
}

/** "Dentiste : demain à 16h." */
export function eventFoundText(hits: CompactEvent[], query: string, now: Date): string {
  const upcoming = hits.filter((h) => startOf(h) > addDays(now, -1));
  if (!upcoming.length) return `Je ne trouve pas d'événement « ${query} » à venir.`;
  const list = upcoming.slice(0, 3).map((h) => `${h.title} ${fmtRelativeDay(startOf(h), now).toLowerCase()}${h.allDay ? "" : ` à ${fmtTime(startOf(h))}`}`);
  return `${cap(joinFr(list))}.`;
}

/** "Samedi, vous êtes libres de 8h à 14h et de 18h à 22h." */
export function availabilityText(r: ToolResult, q: { together: boolean; now: Date; singleDay: Date | null }): string {
  if (!r.ok) return `Je n'ai pas pu chercher de créneau : ${r.summary}.`;
  const slots = ((r.data as { slots?: { start: string; end: string }[] })?.slots ?? []).map((s) => ({ start: parse(s.start), end: parse(s.end) }));
  const who = q.together ? "vous êtes libres" : "vous êtes libre";
  if (!slots.length) return q.singleDay ? `${fmtRelativeDay(q.singleDay, q.now)}, aucun créneau libre.` : "Aucun créneau libre trouvé sur la période.";
  const range = (s: { start: Date; end: Date }) => `de ${fmtTime(s.start)} à ${fmtTime(s.end)}`;
  if (q.singleDay) return `${fmtRelativeDay(q.singleDay, q.now)}, ${who} ${joinFr(slots.slice(0, 4).map(range))}.`;
  const byDay: string[] = [];
  const days = [...new Set(slots.map((s) => s.start.toDateString()))].slice(0, 3);
  for (const ds of days) {
    const list = slots.filter((s) => s.start.toDateString() === ds);
    byDay.push(`${fmtRelativeDay(list[0].start, q.now).toLowerCase()} ${joinFr(list.slice(0, 2).map(range))}`);
  }
  return `${cap(who)} ${joinFr(byDay)}.`;
}
