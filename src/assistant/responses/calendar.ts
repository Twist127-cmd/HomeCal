import { fmtRelativeDay, fmtTime } from "@/lib/dates";
import type { ToolResult } from "../executor";
import { joinFr } from "./common";

interface CompactEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
}

const parse = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00` : s);

export function calendarCreatedText(r: ToolResult, q: { title: string; start: Date; allDay: boolean; who: string[]; now: Date }): string {
  if (!r.ok) return `Je n'ai pas pu ajouter l'événement : ${r.summary}.`;
  const when = `${fmtRelativeDay(q.start, q.now).toLowerCase()}${q.allDay ? ", toute la journée" : ` à ${fmtTime(q.start)}`}`;
  return `✓ ${q.title} ajouté ${when}${q.who.length ? ` pour ${joinFr(q.who)}` : ""}.`;
}

export function describeDay(r: ToolResult, day: Date, now: Date): string {
  if (!r.ok) return `Je n'arrive pas à lire le calendrier : ${r.summary}.`;
  const events = ((r.data as { events?: CompactEvent[] })?.events ?? []).filter((e) => {
    const end = e.end ? parse(e.end) : parse(e.start);
    return end > now || day.toDateString() !== now.toDateString();
  });
  const label = fmtRelativeDay(day, now);
  if (!events.length) return `${label}, rien de prévu.`;
  const items = events.slice(0, 6).map((e) => (e.allDay ? `${e.title} (toute la journée)` : `${e.title} à ${fmtTime(parse(e.start))}`));
  const more = events.length > 6 ? ` et ${events.length - 6} autre(s)` : "";
  return `${label} : ${joinFr(items)}${more}.`;
}

export function nextEventText(r: ToolResult, now: Date): string {
  if (!r.ok) return `Je n'arrive pas à lire le calendrier : ${r.summary}.`;
  const next = ((r.data as { events?: CompactEvent[] })?.events ?? []).find((e) => !e.allDay && parse(e.start) > now);
  if (!next) return "Aucun rendez-vous prévu dans les deux prochaines semaines.";
  const start = parse(next.start);
  return `Prochain rendez-vous : ${next.title}, ${fmtRelativeDay(start, now).toLowerCase()} à ${fmtTime(start)}${next.location ? ` (${next.location})` : ""}.`;
}
