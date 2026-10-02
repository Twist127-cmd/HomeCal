import type { CalendarEvent, NewEvent, Recurrence } from "@/lib/types";
import { ProviderError, type ProviderStatus } from "../errors";
import type { CalendarProvider, ExternalCalendar, SyncResult } from "./CalendarProvider";

/**
 * Google Calendar provider — PREPARED, DISABLED IN V1.
 *
 * Activation (later):
 *  1. Create an OAuth client (Web) in Google Cloud for the Firebase project, enable "Google Calendar API".
 *  2. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=true.
 *  3. connect() opens the Google consent (Google Identity Services token client).
 *
 * Every method throws ProviderError("NOT_CONFIGURED") while the flag is off.
 */

const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";

export const googleCalendarEnabled = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED === "true";
const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void }): GoogleTokenClient;
      revoke(token: string, cb?: () => void): void;
    };
  };
}

interface GEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  recurrence?: string[];
  status?: string;
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google" as const;
  readonly label = "Google Calendar";
  private token: string | null = null;
  private tokenExpiry = 0;
  private calendarId = "primary";

  status(): ProviderStatus {
    if (!googleCalendarEnabled) return "DISABLED";
    if (!clientId) return "NOT_CONFIGURED";
    return this.token && Date.now() < this.tokenExpiry ? "READY" : "DISCONNECTED";
  }

  private assertConfigured() {
    if (!googleCalendarEnabled || !clientId) throw new ProviderError("NOT_CONFIGURED", "Google Calendar n'est pas configuré");
  }

  async connect(): Promise<void> {
    this.assertConfigured();
    const google = await loadGis();
    await new Promise<void>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (r) => {
          if (r.error || !r.access_token) return reject(new ProviderError("AUTH_REQUIRED", r.error));
          this.token = r.access_token;
          this.tokenExpiry = Date.now() + (r.expires_in ?? 3600) * 1000;
          resolve();
        },
      });
      client.requestAccessToken({ prompt: "consent" });
    });
  }

  async disconnect(): Promise<void> {
    if (this.token) {
      const google = await loadGis().catch(() => null);
      google?.accounts.oauth2.revoke(this.token);
    }
    this.token = null;
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    if (!this.token || Date.now() > this.tokenExpiry) throw new ProviderError("AUTH_REQUIRED");
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...init.headers },
    });
    if (!res.ok) throw new ProviderError(res.status === 401 ? "AUTH_REQUIRED" : "UNAVAILABLE", await res.text());
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    const r = await this.api<{ items: { id: string; summary: string; backgroundColor?: string; primary?: boolean; accessRole: string }[] }>(
      "/users/me/calendarList",
    );
    return r.items.map((c) => ({
      id: c.id,
      name: c.summary,
      color: c.backgroundColor,
      primary: c.primary,
      readOnly: c.accessRole === "reader" || c.accessRole === "freeBusyReader",
    }));
  }

  async getEvents(range?: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({ singleEvents: "false", maxResults: "2500" });
    if (range) {
      params.set("timeMin", range.start.toISOString());
      params.set("timeMax", range.end.toISOString());
    }
    const r = await this.api<{ items: GEvent[] }>(`/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`);
    return r.items.filter((e) => e.status !== "cancelled").map(fromGoogle);
  }

  async createEvent(event: NewEvent): Promise<CalendarEvent> {
    const r = await this.api<GEvent>(`/calendars/${encodeURIComponent(this.calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(toGoogle(event)),
    });
    return fromGoogle(r);
  }

  async updateEvent(id: string, patch: Partial<NewEvent>): Promise<CalendarEvent> {
    const r = await this.api<GEvent>(`/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(toGoogle(patch)),
    });
    return fromGoogle(r);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.api<void>(`/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  /** Two-way sync is planned for V2; V1 only exposes the contract. */
  async syncEvents(): Promise<SyncResult> {
    this.assertConfigured();
    throw new ProviderError("NOT_CONFIGURED", "Synchronisation Google Calendar prévue en V2");
  }
}

// ---------------------------------------------------------------- mapping

export function fromGoogle(g: GEvent): CalendarEvent {
  const allDay = !!g.start.date;
  const start = allDay ? new Date(`${g.start.date}T00:00:00`) : new Date(g.start.dateTime!);
  const end = allDay ? new Date(`${g.end.date}T00:00:00`) : new Date(g.end.dateTime!);
  const now = new Date().toISOString();
  return {
    id: `google_${g.id}`,
    externalId: g.id,
    title: g.summary ?? "(sans titre)",
    description: g.description,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    profileIds: [],
    type: "other",
    location: g.location ? { label: g.location, address: g.location } : undefined,
    recurrence: parseRRule(g.recurrence),
    reminders: [],
    source: "google",
    createdAt: now,
    updatedAt: now,
  };
}

export function toGoogle(e: Partial<NewEvent>): Partial<GEvent> {
  const out: Partial<GEvent> = {};
  if (e.title !== undefined) out.summary = e.title;
  if (e.description !== undefined) out.description = e.description;
  if (e.location) out.location = e.location.address ?? e.location.label;
  if (e.start && e.end) {
    if (e.allDay) {
      out.start = { date: e.start.slice(0, 10) };
      out.end = { date: e.end.slice(0, 10) };
    } else {
      out.start = { dateTime: e.start };
      out.end = { dateTime: e.end };
    }
  }
  if (e.recurrence) out.recurrence = [toRRule(e.recurrence)];
  return out;
}

const RR_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function toRRule(r: Recurrence): string {
  const parts = [`FREQ=${r.freq}`];
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.byWeekday?.length) parts.push(`BYDAY=${r.byWeekday.map((d) => RR_DAYS[d]).join(",")}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  if (r.until) parts.push(`UNTIL=${r.until.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
  return `RRULE:${parts.join(";")}`;
}

export function parseRRule(lines?: string[]): Recurrence | undefined {
  const line = lines?.find((l) => l.startsWith("RRULE:"));
  if (!line) return undefined;
  const kv = Object.fromEntries(line.slice(6).split(";").map((p) => p.split("=") as [string, string]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(kv.FREQ)) return undefined;
  return {
    freq: kv.FREQ as Recurrence["freq"],
    interval: kv.INTERVAL ? +kv.INTERVAL : 1,
    byWeekday: kv.BYDAY ? kv.BYDAY.split(",").map((d) => RR_DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0) : undefined,
    count: kv.COUNT ? +kv.COUNT : undefined,
    until: kv.UNTIL
      ? new Date(kv.UNTIL.replace(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/, (_, y, m, d, h = "23", mi = "59", s = "59") => `${y}-${m}-${d}T${h}:${mi}:${s}Z`)).toISOString()
      : undefined,
  };
}

let gisPromise: Promise<GoogleGlobal> | null = null;
function loadGis(): Promise<GoogleGlobal> {
  if (typeof window === "undefined") return Promise.reject(new ProviderError("UNAVAILABLE"));
  const w = window as unknown as { google?: GoogleGlobal };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new ProviderError("UNAVAILABLE")));
    s.onerror = () => reject(new ProviderError("UNAVAILABLE", "Impossible de charger Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisPromise;
}
