import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { findAvailability } from "@/lib/availability";
import { departureTime } from "@/lib/departure";
import { hasCoords } from "@/lib/geo";
import { findProfilesByName, normalize, resolvePersons, concernsProfile } from "@/lib/profiles";
import { expandEvents } from "@/lib/recurrence";
import type {
  CalendarEvent,
  EventLocation,
  EventType,
  FavoritePlace,
  HouseholdSettings,
  NewEvent,
  Occurrence,
  Profile,
  Recurrence,
  Reminder,
  TravelMode,
} from "@/lib/types";
import type { CalendarProvider } from "@/providers/calendar";
import type { GeocodingProvider } from "@/providers/geocoding/GeocodingProvider";
import type { RoutingProvider } from "@/providers/routing/RoutingProvider";
import { describeWeather, type WeatherProvider } from "@/providers/weather/WeatherProvider";
import { isModuleTool, runModuleTool, type ModuleContext } from "./moduleTools";

export interface ToolContext extends ModuleContext {
  now(): Date;
  calendar: CalendarProvider & { restoreEvent?(e: CalendarEvent): Promise<void>; replaceEvent?(e: CalendarEvent): Promise<void> };
  /** Current events snapshot (realtime cache) */
  events(): CalendarEvent[];
  profiles: Profile[];
  places: FavoritePlace[];
  settings: HouseholdSettings;
  homePlaceId?: string;
  currentProfileId?: string;
  weather: WeatherProvider;
  geocoding: GeocodingProvider;
  routing: RoutingProvider;
  createReminder(r: Omit<Reminder, "id" | "createdAt">): Promise<Reminder>;
  deleteReminder(id: string): Promise<void>;
}

export interface ToolResult {
  ok: boolean;
  /** JSON sent back to the LLM */
  data: unknown;
  /** Human summary for the UI */
  summary: string;
  changed?: boolean;
  undo?: () => Promise<void>;
}

const WEEKDAYS: Record<string, number> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const EN_WEEKDAYS: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const TYPES: EventType[] = ["appointment", "sport", "work", "social", "family", "travel", "chore", "other"];

export class ToolError extends Error {}

// ------------------------------------------------------------------ helpers

/** Parse "2026-10-01T16:00", "2026-10-01 16:00", "2026-10-01", ISO with Z/offset. */
export function parseDateArg(v: unknown, name = "date"): { date: Date; dateOnly: boolean } {
  if (typeof v !== "string" || !v.trim()) throw new ToolError(`Paramètre ${name} manquant`);
  const s = v.trim().replace(" ", "T");
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) {
    const d = new Date(s);
    if (isNaN(d.getTime())) throw new ToolError(`Date invalide pour ${name} : ${v} (format attendu 2026-10-01T16:00)`);
    return { date: d, dateOnly: false };
  }
  if (m[7]) return { date: new Date(s), dateOnly: false };
  const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4], m[5], m[6]].map((x) => (x === undefined ? undefined : Number(x)));
  const date = new Date(y!, mo! - 1, d!, h ?? 0, mi ?? 0, sec ?? 0, 0);
  return { date, dateOnly: m[4] === undefined };
}

export function localIso(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && !!x.trim());
  if (typeof v === "string" && v.trim()) return v.split(/,| et /).map((s) => s.trim()).filter(Boolean);
  return [];
}

// ------------------------------------------------------------------ executor

export class ToolExecutor {
  constructor(private readonly ctx: ToolContext) {}

  async run(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (name) {
        case "createEvent":
          return await this.createEvent(args);
        case "updateEvent":
          return await this.updateEvent(args);
        case "moveEvent":
          return await this.moveEvent(args);
        case "deleteEvent":
          return await this.deleteEvent(args);
        case "getEvents":
          return this.getEvents(args);
        case "searchEvents":
          return this.searchEvents(args);
        case "findAvailability":
          return this.findAvailability(args);
        case "getWeather":
          return await this.getWeather(args);
        case "calculateRoute":
          return await this.calculateRoute(args);
        case "getFavoritePlaces":
          return this.getFavoritePlaces();
        case "createReminder":
          return await this.createReminder(args);
        default:
          if (isModuleTool(name)) return await runModuleTool(name, args, this.ctx);
          return { ok: false, data: { error: `Outil inconnu : ${name}` }, summary: `Outil inconnu ${name}` };
      }
    } catch (e) {
      const msg = (e as Error).message;
      return { ok: false, data: { error: msg }, summary: msg };
    }
  }

  // ---------------------------------------------------------------- resolution

  resolveProfiles(v: unknown): string[] {
    const names = strArray(v);
    const { profiles } = this.ctx;
    if (!names.length) return this.ctx.currentProfileId ? [this.ctx.currentProfileId] : [];
    const ids: string[] = [];
    const unknown: string[] = [];
    for (const n of names) {
      const nn = normalize(n);
      if (profiles.some((p) => p.id === n)) {
        ids.push(n);
        continue;
      }
      if (/^(nous( deux)?|tous les deux|couple|nous 2)$/.test(nn)) {
        const c = profiles.find((p) => p.type === "COUPLE");
        if (c) {
          ids.push(c.id);
          continue;
        }
      }
      if (/^(tout le monde|famille|toute la famille|maison|foyer|tous)$/.test(nn)) {
        const h = profiles.find((p) => p.type === "HOUSEHOLD");
        if (h) {
          ids.push(h.id);
          continue;
        }
      }
      if (/^(moi|je)$/.test(nn) && this.ctx.currentProfileId) {
        ids.push(this.ctx.currentProfileId);
        continue;
      }
      const found = findProfilesByName([n], profiles)[0];
      if (found) ids.push(found.id);
      else unknown.push(n);
    }
    if (unknown.length && !ids.length) {
      throw new ToolError(`Profil inconnu : ${unknown.join(", ")}. Profils valides : ${profiles.map((p) => p.name).join(", ")}`);
    }
    return [...new Set(ids)];
  }

  private place(name: string): FavoritePlace | undefined {
    const n = normalize(name);
    return (
      this.ctx.places.find((p) => normalize(p.name) === n) ??
      this.ctx.places.find((p) => normalize(p.name).includes(n) || n.includes(normalize(p.name)))
    );
  }

  private home(): FavoritePlace | undefined {
    return this.ctx.places.find((p) => p.id === this.ctx.homePlaceId) ?? this.ctx.places.find((p) => /maison|home|domicile/i.test(p.name));
  }

  async resolveLocation(v: unknown): Promise<EventLocation | undefined> {
    const s = str(v);
    if (!s) return undefined;
    const fav = this.place(s);
    if (fav) return { label: fav.name, address: fav.address, lat: fav.lat, lng: fav.lng, placeId: fav.id };
    try {
      const home = this.home();
      const [r] = await this.ctx.geocoding.search(s, home ? { lat: home.lat, lng: home.lng } : undefined);
      if (r) return { label: s, address: r.address, lat: r.lat, lng: r.lng };
    } catch {
      /* geocoding offline: keep label only */
    }
    return { label: s };
  }

  private findEvent(args: Record<string, unknown>): CalendarEvent {
    const id = str(args.eventId) ?? str(args.id);
    const events = this.ctx.events();
    if (id) {
      const e = events.find((x) => x.id === id || x.id === id.split("_")[0]);
      if (e) return e;
      // small models sometimes pass the title as id
      const byTitle = this.searchByText(id);
      if (byTitle.length === 1) return byTitle[0].event;
      throw new ToolError(`Événement introuvable : ${id}. Utilise getEvents ou searchEvents pour obtenir l'id.`);
    }
    const q = str(args.title) ?? str(args.query);
    if (q) {
      const hits = this.searchByText(q);
      if (hits.length) return hits[0].event;
    }
    throw new ToolError("eventId manquant");
  }

  private searchByText(q: string, from?: Date, to?: Date): Occurrence[] {
    const now = this.ctx.now();
    const n = normalize(q);
    const occ = expandEvents(this.ctx.events(), from ?? addDays(now, -30), to ?? addDays(now, 180));
    const words = n.split(/\s+/).filter((w) => w.length > 1);
    const scored = occ
      .map((o) => {
        const hay = normalize(`${o.event.title} ${o.event.location?.label ?? ""} ${o.event.description ?? ""}`);
        const score = words.filter((w) => hay.includes(w)).length;
        return { o, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || Math.abs(a.o.start.getTime() - now.getTime()) - Math.abs(b.o.start.getTime() - now.getTime()));
    // de-duplicate recurring series: keep next occurrence
    const seen = new Set<string>();
    const out: Occurrence[] = [];
    for (const { o } of scored) {
      if (seen.has(o.event.id)) continue;
      seen.add(o.event.id);
      out.push(o);
    }
    return out;
  }

  private profileNames(ids: string[]): string[] {
    return ids.map((id) => this.ctx.profiles.find((p) => p.id === id)?.name ?? id);
  }

  private compact(o: Occurrence) {
    return {
      id: o.event.id,
      title: o.event.title,
      start: o.event.allDay ? format(o.start, "yyyy-MM-dd") : localIso(o.start),
      end: o.event.allDay ? undefined : localIso(o.end),
      allDay: o.event.allDay || undefined,
      profiles: this.profileNames(o.event.profileIds),
      location: o.event.location?.label,
      recurring: o.event.recurrence ? true : undefined,
      occurrenceStart: o.event.recurrence ? localIso(o.start) : undefined,
    };
  }

  private parseRecurrence(v: unknown, start: Date): Recurrence | undefined {
    if (!v || typeof v !== "object") return undefined;
    const r = v as Record<string, unknown>;
    const freq = String(r.freq ?? r.frequency ?? "").toUpperCase();
    if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return undefined;
    const days = strArray(r.weekdays ?? r.byWeekday ?? r.days)
      .map((d) => {
        const n = normalize(d);
        return WEEKDAYS[n.replace(/s$/, "")] ?? EN_WEEKDAYS[n.slice(0, 2)] ?? (Number.isInteger(Number(d)) ? Number(d) % 7 : undefined);
      })
      .filter((d): d is number => d !== undefined);
    const until = str(r.until);
    return {
      freq: freq as Recurrence["freq"],
      interval: Math.max(1, num(r.interval) ?? 1),
      byWeekday: freq === "WEEKLY" ? (days.length ? days : [start.getDay()]) : undefined,
      count: num(r.count),
      until: until ? (() => {
        const d = parseDateArg(until, "until").date;
        d.setHours(23, 59, 59, 0);
        return d.toISOString();
      })() : undefined,
    };
  }

  // ---------------------------------------------------------------- tools

  private async createEvent(a: Record<string, unknown>): Promise<ToolResult> {
    const title = str(a.title);
    if (!title) throw new ToolError("title manquant");
    const { date: start, dateOnly } = parseDateArg(a.start, "start");
    const allDay = a.allDay === true || (dateOnly && a.allDay !== false && !a.end && !a.durationMinutes);
    let end: Date;
    if (allDay) {
      start.setHours(0, 0, 0, 0);
      end = a.end ? parseDateArg(a.end, "end").date : addDays(start, 1);
      if (end <= start) end = addDays(start, 1);
    } else if (a.end) {
      end = parseDateArg(a.end, "end").date;
      if (end <= start) end = new Date(start.getTime() + 60 * 60000);
    } else {
      end = new Date(start.getTime() + (num(a.durationMinutes) ?? 60) * 60000);
    }
    const type = TYPES.includes(a.type as EventType) ? (a.type as EventType) : "other";
    const event: NewEvent = {
      title,
      description: str(a.description),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      profileIds: this.resolveProfiles(a.profiles),
      type,
      location: await this.resolveLocation(a.location),
      recurrence: this.parseRecurrence(a.recurrence, start),
      reminders: Array.isArray(a.reminderMinutes) ? a.reminderMinutes.map(Number).filter((n) => n >= 0) : allDay ? [] : [30],
      travel: undefined,
      source: "assistant",
    };
    const created = await this.ctx.calendar.createEvent(event);
    const occ: Occurrence = { key: created.id, event: created, start, end };
    return {
      ok: true,
      changed: true,
      data: { created: this.compact(occ) },
      summary: `Créé « ${title} »`,
      undo: () => this.ctx.calendar.deleteEvent(created.id),
    };
  }

  private async updateEvent(a: Record<string, unknown>): Promise<ToolResult> {
    const before = this.findEvent(a);
    const patch: Partial<NewEvent> = {};
    if (str(a.title)) patch.title = str(a.title);
    if (str(a.description)) patch.description = str(a.description);
    if (a.profiles !== undefined) patch.profileIds = this.resolveProfiles(a.profiles);
    if (str(a.location)) patch.location = await this.resolveLocation(a.location);
    if (typeof a.allDay === "boolean") patch.allDay = a.allDay;
    const duration = new Date(before.end).getTime() - new Date(before.start).getTime();
    if (a.start) {
      const s = parseDateArg(a.start, "start").date;
      patch.start = s.toISOString();
      patch.end = a.end ? parseDateArg(a.end, "end").date.toISOString() : new Date(s.getTime() + duration).toISOString();
    } else if (a.end) {
      patch.end = parseDateArg(a.end, "end").date.toISOString();
    }
    const updated = await this.ctx.calendar.updateEvent(before.id, patch);
    return {
      ok: true,
      changed: true,
      data: { updated: this.compact({ key: updated.id, event: updated, start: new Date(updated.start), end: new Date(updated.end) }) },
      summary: `Modifié « ${updated.title} »`,
      undo: () => this.restore(before),
    };
  }

  private async restore(e: CalendarEvent) {
    if (this.ctx.calendar.restoreEvent) await this.ctx.calendar.restoreEvent(e);
    else await this.ctx.calendar.updateEvent(e.id, e);
  }

  private async moveEvent(a: Record<string, unknown>): Promise<ToolResult> {
    const before = this.findEvent(a);
    const newStart = parseDateArg(a.newStart ?? a.start, "newStart").date;
    const duration = new Date(before.end).getTime() - new Date(before.start).getTime();

    if (before.recurrence && a.occurrenceStart) {
      // move a single occurrence: exclude it from the series, create a standalone copy
      const occStart = parseDateArg(a.occurrenceStart, "occurrenceStart").date;
      const occ = expandEvents([before], addDays(occStart, -1), addDays(occStart, 1)).find(
        (o) => Math.abs(o.start.getTime() - occStart.getTime()) < 60000,
      );
      if (!occ) throw new ToolError("Occurrence introuvable");
      const exdates = [...(before.recurrence.exdates ?? []), occ.start.toISOString()];
      await this.ctx.calendar.updateEvent(before.id, { recurrence: { ...before.recurrence, exdates } });
      const { id, createdAt, updatedAt, ...rest } = before;
      void id;
      void createdAt;
      void updatedAt;
      const copy = await this.ctx.calendar.createEvent({
        ...rest,
        recurrence: undefined,
        start: newStart.toISOString(),
        end: new Date(newStart.getTime() + duration).toISOString(),
      });
      return {
        ok: true,
        changed: true,
        data: { moved: { id: copy.id, title: copy.title, start: localIso(newStart) } },
        summary: `Déplacé « ${before.title} » au ${format(newStart, "dd.MM HH:mm")}`,
        undo: async () => {
          await this.ctx.calendar.deleteEvent(copy.id);
          await this.restore(before);
        },
      };
    }

    const updated = await this.ctx.calendar.updateEvent(before.id, {
      start: newStart.toISOString(),
      end: new Date(newStart.getTime() + duration).toISOString(),
    });
    return {
      ok: true,
      changed: true,
      data: { moved: { id: updated.id, title: updated.title, start: localIso(newStart) } },
      summary: `Déplacé « ${updated.title} » au ${format(newStart, "dd.MM HH:mm")}`,
      undo: () => this.restore(before),
    };
  }

  private async deleteEvent(a: Record<string, unknown>): Promise<ToolResult> {
    const before = this.findEvent(a);
    if (before.recurrence && a.allOccurrences !== true) {
      const occStart = a.occurrenceStart ? parseDateArg(a.occurrenceStart, "occurrenceStart").date : this.ctx.now();
      const next = expandEvents([before], addDays(occStart, -1), addDays(occStart, 400)).find(
        (o) => o.start.getTime() >= occStart.getTime() - 60000,
      );
      if (!next) throw new ToolError("Occurrence introuvable");
      const exdates = [...(before.recurrence.exdates ?? []), next.start.toISOString()];
      await this.ctx.calendar.updateEvent(before.id, { recurrence: { ...before.recurrence, exdates } });
      return {
        ok: true,
        changed: true,
        data: { deletedOccurrence: { id: before.id, title: before.title, start: localIso(next.start) } },
        summary: `Supprimé « ${before.title} » du ${format(next.start, "dd.MM")}`,
        undo: () => this.restore(before),
      };
    }
    await this.ctx.calendar.deleteEvent(before.id);
    return {
      ok: true,
      changed: true,
      data: { deleted: { id: before.id, title: before.title } },
      summary: `Supprimé « ${before.title} »`,
      undo: () => this.restore(before),
    };
  }

  private occurrencesFor(from: Date, to: Date, profileIds: string[]): Occurrence[] {
    const occ = expandEvents(this.ctx.events(), from, to);
    if (!profileIds.length) return occ;
    return occ.filter((o) => profileIds.some((p) => concernsProfile(o.event.profileIds, p, this.ctx.profiles)));
  }

  private getEvents(a: Record<string, unknown>): ToolResult {
    const from = parseDateArg(a.from, "from");
    const to = parseDateArg(a.to, "to");
    const toDate = to.dateOnly ? addDays(to.date, 1) : to.date;
    const profileIds = strArray(a.profiles).length ? this.resolveProfiles(a.profiles) : [];
    const occ = this.occurrencesFor(from.date, toDate <= from.date ? addDays(from.date, 1) : toDate, profileIds);
    return {
      ok: true,
      data: { count: occ.length, events: occ.slice(0, 40).map((o) => this.compact(o)) },
      summary: `${occ.length} événement(s) trouvé(s)`,
    };
  }

  private searchEvents(a: Record<string, unknown>): ToolResult {
    const q = str(a.query);
    if (!q) throw new ToolError("query manquant");
    const from = a.from ? parseDateArg(a.from, "from").date : undefined;
    const to = a.to ? parseDateArg(a.to, "to").date : undefined;
    const hits = this.searchByText(q, from, to);
    return { ok: true, data: { count: hits.length, events: hits.slice(0, 15).map((o) => this.compact(o)) }, summary: `${hits.length} résultat(s) pour « ${q} »` };
  }

  private findAvailability(a: Record<string, unknown>): ToolResult {
    const from = parseDateArg(a.from, "from");
    const to = parseDateArg(a.to, "to");
    let fromDate = from.date;
    const now = this.ctx.now();
    if (fromDate < now) fromDate = now;
    const toDate = to.dateOnly ? addDays(to.date, 1) : to.date;
    const duration = num(a.durationMinutes) ?? 60;
    const profileIds = strArray(a.profiles).length
      ? this.resolveProfiles(a.profiles)
      : this.ctx.profiles.filter((p) => p.type === "PERSON").map((p) => p.id);
    const occurrences = expandEvents(this.ctx.events(), addDays(fromDate, -1), addDays(toDate, 1));
    const slots = findAvailability({
      occurrences,
      profiles: this.ctx.profiles,
      profileIds,
      from: fromDate,
      to: toDate,
      durationMin: duration,
      dayStartHour: num(a.dayStartHour) ?? Math.max(8, this.ctx.settings.dayStartHour),
      dayEndHour: num(a.dayEndHour) ?? Math.min(22, this.ctx.settings.dayEndHour),
      maxResults: 8,
    });
    const persons = [...resolvePersons(profileIds, this.ctx.profiles)];
    return {
      ok: true,
      data: {
        for: this.profileNames(persons),
        durationMinutes: duration,
        slots: slots.map((s) => ({ start: localIso(s.start), end: localIso(s.end), weekday: format(s.start, "EEEE", { locale: fr }) })),
      },
      summary: `${slots.length} créneau(x) libre(s)`,
    };
  }

  private async getWeather(a: Record<string, unknown>): Promise<ToolResult> {
    let at = a.date ? parseDateArg(a.date, "date") : { date: this.ctx.now(), dateOnly: false };
    let loc: EventLocation | undefined;
    if (str(a.eventId)) {
      const e = this.findEvent(a);
      loc = e.location;
      at = { date: new Date(e.start), dateOnly: e.allDay };
    }
    if (!loc && str(a.location)) {
      loc = await this.resolveLocation(a.location);
      // never answer with the home weather when the user asked for another place
      if (!hasCoords(loc)) throw new ToolError(`Lieu introuvable pour la météo : ${a.location}`);
    }
    if (!hasCoords(loc)) {
      const h = this.home();
      if (!h) throw new ToolError("Aucun lieu « Maison » configuré pour la météo");
      loc = { label: h.name, lat: h.lat, lng: h.lng };
    }
    const f = await this.ctx.weather.getForecast(loc.lat!, loc.lng!);
    if (at.dateOnly) {
      const day = f.daily.find((d) => format(d.date, "yyyy-MM-dd") === format(at.date, "yyyy-MM-dd"));
      if (!day) return { ok: false, data: { error: "Prévision indisponible (au-delà de 16 jours)" }, summary: "Météo indisponible" };
      const w = describeWeather(day.weatherCode);
      return {
        ok: true,
        data: {
          location: loc.label,
          date: format(day.date, "yyyy-MM-dd"),
          conditions: w.label,
          tMin: Math.round(day.tMin),
          tMax: Math.round(day.tMax),
          precipitationProbability: day.precipitationProbability,
          windMaxKmh: Math.round(day.windMax),
        },
        summary: `${w.emoji} ${Math.round(day.tMin)}–${Math.round(day.tMax)}°C à ${loc.label}`,
      };
    }
    const p = await this.ctx.weather.getAt(loc.lat!, loc.lng!, at.date);
    if (!p) return { ok: false, data: { error: "Prévision indisponible (au-delà de 16 jours)" }, summary: "Météo indisponible" };
    const w = describeWeather(p.weatherCode, p.isDay);
    return {
      ok: true,
      data: {
        location: loc.label,
        time: localIso(p.time),
        conditions: w.label,
        temperature: Math.round(p.temperature),
        precipitationProbability: p.precipitationProbability,
        precipitationMm: p.precipitation,
        windKmh: Math.round(p.windSpeed),
      },
      summary: `${w.emoji} ${Math.round(p.temperature)}°C à ${loc.label}`,
    };
  }

  private async calculateRoute(a: Record<string, unknown>): Promise<ToolResult> {
    const toArg = str(a.to);
    if (!toArg) throw new ToolError("to manquant");
    let to: EventLocation | undefined;
    let arriveBy = a.arriveBy ? parseDateArg(a.arriveBy, "arriveBy").date : undefined;
    const ev = this.ctx.events().find((e) => e.id === toArg);
    if (ev) {
      to = ev.location;
      arriveBy ??= new Date(ev.start);
    } else to = await this.resolveLocation(toArg);
    const from = str(a.from) ? await this.resolveLocation(a.from) : (() => {
      const h = this.home();
      return h ? { label: h.name, lat: h.lat, lng: h.lng } : undefined;
    })();
    if (!hasCoords(to)) throw new ToolError(`Lieu introuvable : ${toArg}`);
    if (!hasCoords(from)) throw new ToolError("Lieu de départ inconnu (configure « Maison » dans les lieux favoris)");
    const mode = (["driving", "cycling", "walking"].includes(String(a.mode)) ? a.mode : this.ctx.settings.defaultTravelMode) as TravelMode;
    const r = await this.ctx.routing.route(from, to, mode);
    const margin = this.ctx.settings.travelMarginMin;
    const departAt = arriveBy ? departureTime(arriveBy, r.durationMin, margin) : undefined;
    return {
      ok: true,
      data: {
        from: from.label,
        to: to.label,
        mode,
        durationMinutes: r.durationMin,
        distanceKm: r.distanceKm,
        estimated: r.source === "estimate" || undefined,
        marginMinutes: margin,
        departAt: departAt ? localIso(departAt) : undefined,
      },
      summary: `${r.durationMin} min (${r.distanceKm} km) vers ${to.label}${departAt ? `, départ ${format(departAt, "HH:mm")}` : ""}`,
    };
  }

  private getFavoritePlaces(): ToolResult {
    return {
      ok: true,
      data: { places: this.ctx.places.map((p) => ({ name: p.name, address: p.address })) },
      summary: `${this.ctx.places.length} lieu(x) favori(s)`,
    };
  }

  private async createReminder(a: Record<string, unknown>): Promise<ToolResult> {
    const text = str(a.text);
    if (!text) throw new ToolError("text manquant");
    const at = parseDateArg(a.at, "at").date;
    const r = await this.ctx.createReminder({
      text,
      at: at.toISOString(),
      profileIds: this.resolveProfiles(a.profiles),
      eventId: str(a.eventId),
      done: false,
    });
    return {
      ok: true,
      changed: true,
      data: { reminder: { text, at: localIso(at) } },
      summary: `Rappel « ${text} » le ${format(at, "dd.MM à HH:mm")}`,
      undo: () => this.ctx.deleteReminder(r.id),
    };
  }
}
