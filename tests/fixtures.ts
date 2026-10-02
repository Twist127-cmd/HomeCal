import type { CalendarEvent, FavoritePlace, Occurrence, Profile } from "@/lib/types";

export const profiles: Profile[] = [
  { id: "clement", name: "Clément", color: "#6366f1", avatar: "C", type: "PERSON", memberIds: [], order: 0 },
  { id: "compagne", name: "Compagne", color: "#ec4899", avatar: "L", type: "PERSON", memberIds: [], order: 1 },
  { id: "couple", name: "Couple", color: "#8b5cf6", avatar: "💞", type: "COUPLE", memberIds: ["clement", "compagne"], order: 2 },
  { id: "maison", name: "Maison", color: "#10b981", avatar: "🏠", type: "HOUSEHOLD", memberIds: [], order: 3 },
];

export const places: FavoritePlace[] = [
  { id: "home", name: "Maison", address: "Rue du Lac 1, Lausanne", lat: 46.5197, lng: 6.6323, icon: "🏠", profileIds: [], order: 0 },
  { id: "crossfit", name: "CrossFit", address: "Av. de Sévelin 20, Lausanne", lat: 46.5225, lng: 6.6165, icon: "🏋️", profileIds: [], order: 1 },
  { id: "gare", name: "Gare", address: "Place de la Gare, Lausanne", lat: 46.5168, lng: 6.6291, icon: "🚉", profileIds: [], order: 2 },
  { id: "parents", name: "Parents", address: "Genève", lat: 46.2044, lng: 6.1432, icon: "👪", profileIds: [], order: 3 },
];

let n = 0;
export function ev(partial: Partial<CalendarEvent> & { start: string; end: string }): CalendarEvent {
  n++;
  return {
    id: partial.id ?? `e${n}`,
    title: partial.title ?? `Event ${n}`,
    allDay: false,
    profileIds: ["clement"],
    type: "other",
    reminders: [],
    source: "local",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

export function occ(e: CalendarEvent): Occurrence {
  const start = new Date(e.start);
  return { key: `${e.id}_${start.toISOString()}`, event: e, start, end: new Date(e.end) };
}

/** Local time helper: d(2026, 10, 1, 16, 0) = 1 Oct 2026 16:00 local */
export function d(y: number, mo: number, day: number, h = 0, mi = 0): Date {
  return new Date(y, mo - 1, day, h, mi, 0, 0);
}
